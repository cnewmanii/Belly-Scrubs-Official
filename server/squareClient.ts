// Square SDK v44 uses SquareClient/SquareEnvironment (not Client/Environment).
// The CJS bundle loads via require("square"), so we use the CJS-compatible names.
const square = require("square") as typeof import("square");
const { SquareClient, SquareEnvironment } = square;

import { log } from "./index";

type SquareClientType = InstanceType<typeof SquareClient>;

let squareClient: SquareClientType | null = null;

export function getSquareClient(): SquareClientType {
  if (!squareClient) {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    if (!accessToken) {
      console.warn("SQUARE: SQUARE_ACCESS_TOKEN not configured — Square API calls will fail");
      throw new Error("SQUARE_ACCESS_TOKEN not configured");
    }
    console.log("SQUARE: Initializing Square client (Production environment)");
    squareClient = new SquareClient({
      token: accessToken,
      environment: SquareEnvironment.Production,
    });
  }
  return squareClient;
}

export function getSquareLocationId(): string {
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) {
    throw new Error("SQUARE_LOCATION_ID not configured");
  }
  return locationId;
}

export interface SquareAppointmentData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  petName: string;
  petBreed: string | null;
  serviceName: string;
  addOns: string[];
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24hr)
  totalPrice: number;
  depositAmount: number;
  notes: string | null;
}

/**
 * Create an appointment in Square Bookings API.
 * Puts all service/add-on/pet details into the appointment note
 * since we're using fixed time slots rather than Square's service catalog.
 */
export async function createSquareAppointment(
  data: SquareAppointmentData
): Promise<string> {
  const client = getSquareClient();
  const locationId = getSquareLocationId();

  // Build a descriptive note for the Square appointment
  const noteLines = [
    `Service: ${data.serviceName}`,
    data.addOns.length > 0 ? `Add-ons: ${data.addOns.join(", ")}` : null,
    `Pet: ${data.petName}${data.petBreed ? ` (${data.petBreed})` : ""}`,
    `Total Price: $${data.totalPrice}`,
    `Deposit Paid: $${data.depositAmount} (non-refundable, via Stripe)`,
    `Remaining Balance: $${data.totalPrice - data.depositAmount}`,
    data.notes ? `Notes: ${data.notes}` : null,
    `Booked online via bellyscrubs.com`,
  ]
    .filter(Boolean)
    .join("\n");

  // Parse date and time into ISO 8601 format
  const [year, month, day] = data.date.split("-").map(Number);
  const [hour, minute] = data.time.split(":").map(Number);
  const startAt = new Date(year, month - 1, day, hour, minute);
  // Default 2-hour appointment block for grooming
  const endMinutes = 120;

  try {
    console.log(`SQUARE: Creating appointment for ${data.petName} on ${data.date} at ${data.time}`);

    // First, search for or create the customer in Square
    const customerId = await findOrCreateSquareCustomer(
      data.customerName,
      data.customerEmail,
      data.customerPhone
    );

    console.log(`SQUARE: Customer resolved: ${customerId}, creating booking...`);
    const response = await client.bookings.create({
      booking: {
        startAt: startAt.toISOString(),
        locationId,
        customerId,
        customerNote: noteLines,
        appointmentSegments: [
          {
            durationMinutes: endMinutes,
            teamMemberId: "anyone",
          },
        ],
      },
      idempotencyKey: `belly-scrubs-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    });

    const bookingId = response.booking?.id;
    if (!bookingId) {
      throw new Error("Square did not return a booking ID");
    }

    log(`Square appointment created: ${bookingId}`, "square");
    return bookingId;
  } catch (error: any) {
    // If the Bookings API isn't available (requires Square Appointments subscription),
    // fall back to creating a simple note via the Customers API
    console.error("SQUARE: Bookings API error:", error.message, error.body || "");
    log(`Square Bookings API error: ${error.message}`, "square");

    // Fallback: Create as a customer note if Bookings API fails
    try {
      console.log("SQUARE: Falling back to customer note...");
      const customerId = await findOrCreateSquareCustomer(
        data.customerName,
        data.customerEmail,
        data.customerPhone
      );

      // Update customer with appointment note
      await client.customers.update({
        customerId,
        note: `UPCOMING APPOINTMENT - ${data.date} at ${data.time}\n${noteLines}`,
      });

      console.log(`SQUARE: Customer note created for: ${customerId}`);
      log(`Square customer note created for: ${customerId}`, "square");
      return `customer-note-${customerId}`;
    } catch (fallbackError: any) {
      console.error("SQUARE: Fallback (customer note) also failed:", fallbackError.message);
      log(`Square fallback error: ${fallbackError.message}`, "square");
      throw new Error(`Failed to create Square appointment: ${error.message}`);
    }
  }
}

/**
 * Find an existing Square customer by email, or create a new one.
 */
async function findOrCreateSquareCustomer(
  name: string,
  email: string,
  phone: string
): Promise<string> {
  const client = getSquareClient();

  // Search for existing customer by email
  try {
    console.log(`SQUARE: Searching for customer by email: ${email}`);
    const searchResponse = await client.customers.search({
      query: {
        filter: {
          emailAddress: {
            exact: email,
          },
        },
      },
    });

    if (searchResponse.customers && searchResponse.customers.length > 0) {
      console.log(`SQUARE: Found existing customer: ${searchResponse.customers[0].id}`);
      return searchResponse.customers[0].id!;
    }
    console.log("SQUARE: No existing customer found, creating new...");
  } catch (searchErr: any) {
    console.error("SQUARE: Customer search failed:", searchErr.message);
    // Search failed, try creating
  }

  // Create new customer
  const nameParts = name.trim().split(/\s+/);
  const givenName = nameParts[0] || name;
  const familyName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  const createResponse = await client.customers.create({
    givenName,
    familyName,
    emailAddress: email,
    phoneNumber: phone,
    idempotencyKey: `belly-scrubs-customer-${email}-${Date.now()}`,
  });

  const customerId = createResponse.customer?.id;
  if (!customerId) {
    throw new Error("Square did not return a customer ID");
  }

  return customerId;
}

export interface OccupiedSlot {
  time: string;            // "HH:MM" fixed slot time
  teamMemberId?: string;   // Square team member ID if available
}

/**
 * Check Square for existing appointments on a given date.
 * Returns occupied slot info including which team member is booked,
 * so the availability endpoint can do per-groomer availability checks.
 */
export async function getSquareOccupiedSlots(date: string): Promise<OccupiedSlot[]> {
  const client = getSquareClient();
  const locationId = getSquareLocationId();

  const [year, month, day] = date.split("-").map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59);

  try {
    console.log(`SQUARE: Checking occupied slots for ${date} (location: ${locationId})`);
    const response = await client.bookings.list({
      locationId,
      startAtMin: startOfDay.toISOString(),
      startAtMax: endOfDay.toISOString(),
    });

    const occupied: OccupiedSlot[] = [];
    const bookings = response.bookings || [];
    console.log(`SQUARE: Found ${bookings.length} existing booking(s) on ${date}`);

    for (const booking of bookings) {
      if (booking.status === "CANCELLED_BY_CUSTOMER" || booking.status === "CANCELLED_BY_SELLER") {
        continue;
      }

      if (booking.startAt) {
        const startTime = new Date(booking.startAt);
        const bookingStartMinutes = startTime.getHours() * 60 + startTime.getMinutes();

        // Get duration and team member from appointment segments
        let durationMinutes = 120; // default 2 hours
        let teamMemberId: string | undefined;
        if (booking.appointmentSegments && booking.appointmentSegments.length > 0) {
          durationMinutes = Number(booking.appointmentSegments[0].durationMinutes) || 120;
          const tmId = booking.appointmentSegments[0].teamMemberId;
          if (tmId && tmId !== "anyone") {
            teamMemberId = tmId;
          }
        }
        const bookingEndMinutes = bookingStartMinutes + durationMinutes;

        // Check each fixed slot (9:00, 11:00, 13:00, 15:00) for overlap
        const fixedSlots = [
          { time: "09:00", minutes: 540 },
          { time: "11:00", minutes: 660 },
          { time: "13:00", minutes: 780 },
          { time: "15:00", minutes: 900 },
        ];

        for (const slot of fixedSlots) {
          const slotEnd = slot.minutes + 120;
          if (bookingStartMinutes < slotEnd && bookingEndMinutes > slot.minutes) {
            occupied.push({ time: slot.time, teamMemberId });
          }
        }
      }
    }

    return occupied;
  } catch (error: any) {
    console.error(`SQUARE: Availability check failed for ${date}:`, error.message);
    log(`Square availability check error: ${error.message}`, "square");
    // If Square API fails, return empty (all slots available) to not block bookings
    return [];
  }
}
