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
 * Create an appointment record in Square.
 *
 * This account does not have bookable services configured in the Square catalog,
 * so the Bookings API (which requires serviceVariationId) cannot be used.
 * Instead we create a detailed customer note that staff can see in Square Dashboard.
 *
 * The note format is designed to be scannable in the Square customer profile:
 *   ★ ONLINE BOOKING — [date] at [time]
 *   Service / Pet / Price / Deposit info
 */
export async function createSquareAppointment(
  data: SquareAppointmentData
): Promise<string> {
  const client = getSquareClient();

  // Format time for readability
  const [h, m] = data.time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const displayTime = `${displayHour}:${m.toString().padStart(2, "0")} ${ampm}`;

  const noteLines = [
    `★ ONLINE BOOKING — ${data.date} at ${displayTime}`,
    `Service: ${data.serviceName}`,
    data.addOns.length > 0 ? `Add-ons: ${data.addOns.join(", ")}` : null,
    `Pet: ${data.petName}${data.petBreed ? ` (${data.petBreed})` : ""}`,
    `Total: $${data.totalPrice}`,
    data.depositAmount > 0
      ? `Deposit: $${data.depositAmount} paid (non-refundable) | Remaining: $${data.totalPrice - data.depositAmount}`
      : `No deposit collected`,
    data.notes ? `Notes: ${data.notes}` : null,
    `— booked via bellyscrubs.com`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    console.log(`SQUARE: Creating customer note for ${data.petName} on ${data.date} at ${data.time}`);

    const customerId = await findOrCreateSquareCustomer(
      data.customerName,
      data.customerEmail,
      data.customerPhone
    );

    await client.customers.update({
      customerId,
      note: noteLines,
    });

    console.log(`SQUARE: Customer note created for ${data.customerName} (${customerId})`);
    log(`Square customer note created: ${customerId} — ${data.date} ${data.time}`, "square");
    return `customer-note-${customerId}`;
  } catch (error: any) {
    console.error("SQUARE: Customer note creation failed:", error.message);
    log(`Square customer note error: ${error.message}`, "square");
    throw new Error(`Failed to create Square record: ${error.message}`);
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

// Fixed booking time slots used across the availability system
const FIXED_SLOTS = [
  { time: "09:00", minutes: 540 },
  { time: "11:00", minutes: 660 },
  { time: "13:00", minutes: 780 },
  { time: "15:00", minutes: 900 },
];

// ---------------------------------------------------------------------------
// Team Members
// ---------------------------------------------------------------------------

export interface SquareTeamMember {
  id: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  isOwner: boolean;
}

/**
 * List all active team members for this location from Square.
 * Used at startup to map groomer names → Square team member IDs.
 */
export async function listSquareTeamMembers(): Promise<SquareTeamMember[]> {
  const client = getSquareClient();
  const locationId = getSquareLocationId();

  try {
    console.log(`SQUARE: Fetching team members for location ${locationId}...`);
    const response = await client.teamMembers.search({
      query: {
        filter: {
          locationIds: [locationId],
          status: "ACTIVE" as any,
        },
      },
      limit: 50,
    });

    const members: SquareTeamMember[] = [];
    for (const tm of response.teamMembers || []) {
      if (!tm.id) continue;
      const given = tm.givenName || "";
      const family = tm.familyName || "";
      const display = `${given} ${family}`.trim() || tm.id;
      members.push({
        id: tm.id,
        displayName: display,
        givenName: given || undefined,
        familyName: family || undefined,
        isOwner: tm.isOwner === true,
      });
    }

    console.log(`SQUARE: Found ${members.length} active team member(s):`);
    for (const m of members) {
      console.log(`  - ${m.displayName} → ${m.id}${m.isOwner ? " (owner)" : ""}`);
    }

    return members;
  } catch (error: any) {
    console.error("SQUARE: Team member lookup failed:", error.message);
    log(`Square team member lookup error: ${error.message}`, "square");
    return [];
  }
}

// ---------------------------------------------------------------------------
// getSquareOccupiedSlots — check existing bookings for a date
// ---------------------------------------------------------------------------

/**
 * Check Square for existing appointments on a given date using bookings.list().
 * Returns occupied slot info including which team member is booked, so the
 * availability endpoint can do per-groomer checks.
 *
 * KNOWN LIMITATION: bookings.list() returns bookings created through the API
 * and through the Square Appointments app. However, ad-hoc schedule changes
 * (days off, modified hours) are NOT reflected here — those are handled by
 * the hardcoded groomer schedules in groomerConfig.ts. If a groomer takes an
 * unplanned day off, staff should manually mark those slots in Square to
 * create blocking bookings, or the hardcoded schedule should be updated.
 *
 * Square's searchAvailability API would handle this automatically, but it
 * requires bookable service variations in the catalog which this account
 * does not have configured.
 */
export async function getSquareOccupiedSlots(date: string): Promise<OccupiedSlot[]> {
  const client = getSquareClient();
  const locationId = getSquareLocationId();

  const [year, month, day] = date.split("-").map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59);

  try {
    console.log(`SQUARE: Checking occupied slots via bookings.list for ${date}`);
    const page = await client.bookings.list({
      locationId,
      startAtMin: startOfDay.toISOString(),
      startAtMax: endOfDay.toISOString(),
    });

    const occupied: OccupiedSlot[] = [];
    const bookings = page.data || [];
    console.log(`SQUARE: Found ${bookings.length} booking(s) on ${date}`);

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

        for (const slot of FIXED_SLOTS) {
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
    return [];
  }
}
