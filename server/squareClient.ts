import pkg from "square";
const { Client, Environment } = pkg;
import { log } from "./index";

let squareClient: Client | null = null;

export function getSquareClient(): Client {
  if (!squareClient) {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("SQUARE_ACCESS_TOKEN not configured");
    }
    squareClient = new Client({
      accessToken,
      environment: Environment.Production,
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
    // First, search for or create the customer in Square
    const customerId = await findOrCreateSquareCustomer(
      data.customerName,
      data.customerEmail,
      data.customerPhone
    );

    const response = await client.bookingsApi.createBooking({
      booking: {
        startAt: startAt.toISOString(),
        locationId,
        customerId,
        customerNote: noteLines,
        appointmentSegments: [
          {
            durationMinutes: BigInt(endMinutes),
            teamMemberId: "anyone",
            serviceVariationId: undefined as any,
            serviceVariationVersion: undefined as any,
          },
        ],
      },
      idempotencyKey: `belly-scrubs-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    });

    const bookingId = response.result.booking?.id;
    if (!bookingId) {
      throw new Error("Square did not return a booking ID");
    }

    log(`Square appointment created: ${bookingId}`, "square");
    return bookingId;
  } catch (error: any) {
    // If the Bookings API isn't available (requires Square Appointments subscription),
    // fall back to creating a simple note via the Orders or Customers API
    log(`Square Bookings API error: ${error.message}`, "square");

    // Fallback: Create as a customer note if Bookings API fails
    try {
      const customerId = await findOrCreateSquareCustomer(
        data.customerName,
        data.customerEmail,
        data.customerPhone
      );

      // Update customer with appointment note
      await client.customersApi.updateCustomer(customerId, {
        note: `UPCOMING APPOINTMENT - ${data.date} at ${data.time}\n${noteLines}`,
      });

      log(`Square customer note created for: ${customerId}`, "square");
      return `customer-note-${customerId}`;
    } catch (fallbackError: any) {
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
    const searchResponse = await client.customersApi.searchCustomers({
      query: {
        filter: {
          emailAddress: {
            exact: email,
          },
        },
      },
    });

    if (searchResponse.result.customers && searchResponse.result.customers.length > 0) {
      return searchResponse.result.customers[0].id!;
    }
  } catch {
    // Search failed, try creating
  }

  // Create new customer
  const nameParts = name.trim().split(/\s+/);
  const givenName = nameParts[0] || name;
  const familyName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  const createResponse = await client.customersApi.createCustomer({
    givenName,
    familyName,
    emailAddress: email,
    phoneNumber: phone,
    idempotencyKey: `belly-scrubs-customer-${email}-${Date.now()}`,
  });

  const customerId = createResponse.result.customer?.id;
  if (!customerId) {
    throw new Error("Square did not return a customer ID");
  }

  return customerId;
}

/**
 * Check Square for existing appointments on a given date.
 * Returns the start times (as "HH:MM" strings) that are occupied.
 */
export async function getSquareOccupiedSlots(date: string): Promise<string[]> {
  const client = getSquareClient();
  const locationId = getSquareLocationId();

  const [year, month, day] = date.split("-").map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59);

  try {
    const response = await client.bookingsApi.listBookings(
      undefined, // cursor
      undefined, // limit
      undefined, // teamMemberId
      locationId,
      startOfDay.toISOString(),
      endOfDay.toISOString()
    );

    const occupiedTimes: string[] = [];
    const bookings = response.result.bookings || [];

    for (const booking of bookings) {
      if (booking.status === "CANCELLED_BY_CUSTOMER" || booking.status === "CANCELLED_BY_SELLER") {
        continue;
      }

      if (booking.startAt) {
        const startTime = new Date(booking.startAt);
        const bookingStartMinutes = startTime.getHours() * 60 + startTime.getMinutes();

        // Get duration from appointment segments
        let durationMinutes = 120; // default 2 hours
        if (booking.appointmentSegments && booking.appointmentSegments.length > 0) {
          durationMinutes = Number(booking.appointmentSegments[0].durationMinutes) || 120;
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
          // Each booking slot is 2 hours
          const slotEnd = slot.minutes + 120;

          // Check if the Square booking overlaps with this slot
          if (bookingStartMinutes < slotEnd && bookingEndMinutes > slot.minutes) {
            occupiedTimes.push(slot.time);
          }
        }
      }
    }

    return [...new Set(occupiedTimes)]; // deduplicate
  } catch (error: any) {
    log(`Square availability check error: ${error.message}`, "square");
    // If Square API fails, return empty (all slots available) to not block bookings
    return [];
  }
}
