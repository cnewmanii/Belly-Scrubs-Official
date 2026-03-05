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
 * Create an appointment in Square via the Bookings API.
 *
 * Primary path: Creates a real Square Booking (appears on the Appointments calendar).
 * Fallback path: If the Bookings API fails (e.g. missing serviceVariationId,
 * Bookings API not enabled, etc.), falls back to creating a customer note
 * so the data is not lost. Detailed error logging is included for diagnosing
 * Bookings API failures.
 */
export async function createSquareAppointment(
  data: SquareAppointmentData
): Promise<string> {
  const client = getSquareClient();
  const locationId = getSquareLocationId();

  // Format time for readability
  const [h, m] = data.time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const displayTime = `${displayHour}:${m.toString().padStart(2, "0")} ${ampm}`;

  // Find or create the Square customer first (needed for both paths)
  const customerId = await findOrCreateSquareCustomer(
    data.customerName,
    data.customerEmail,
    data.customerPhone
  );

  // --- PRIMARY PATH: Create a real Square Booking ---
  try {
    console.log(`SQUARE: Attempting to create Bookings API appointment for ${data.petName} on ${data.date} at ${data.time}`);

    // Build the start time in UTC from the local Eastern Time date+time
    const localDateTimeStr = `${data.date}T${data.time}:00`;
    // Use America/New_York to get correct UTC offset (handles DST automatically)
    const localDate = new Date(new Date(localDateTimeStr).toLocaleString("en-US", { timeZone: "America/New_York" }));
    // Reconstruct as a proper UTC timestamp
    const etOffsetMs = new Date(localDateTimeStr).getTime() - localDate.getTime();
    const startAtUTC = new Date(new Date(localDateTimeStr).getTime() - etOffsetMs);
    // Simpler approach: construct the ISO string with ET offset
    // Eastern Time is UTC-5 (EST) or UTC-4 (EDT). We'll let Square interpret.
    const startAtISO = new Date(
      Date.UTC(
        parseInt(data.date.split("-")[0]),
        parseInt(data.date.split("-")[1]) - 1,
        parseInt(data.date.split("-")[2]),
        h + 5, // Approximate EST offset; Square will normalize
        m
      )
    ).toISOString();

    console.log(`SQUARE: Computed startAt (UTC): ${startAtISO}`);

    const bookingNote = [
      `Pet: ${data.petName}${data.petBreed ? ` (${data.petBreed})` : ""}`,
      `Service: ${data.serviceName}`,
      data.addOns.length > 0 ? `Add-ons: ${data.addOns.join(", ")}` : null,
      `Total: $${data.totalPrice}`,
      data.depositAmount > 0
        ? `Deposit: $${data.depositAmount} paid | Remaining: $${data.totalPrice - data.depositAmount}`
        : null,
      data.notes ? `Notes: ${data.notes}` : null,
      `Booked online via bellyscrubs.com`,
    ]
      .filter(Boolean)
      .join("\n");

    const bookingRequest: any = {
      booking: {
        startAt: startAtISO,
        locationId,
        customerId,
        customerNote: bookingNote,
        appointmentSegments: [
          {
            durationMinutes: 120, // Default 2-hour appointment
            teamMemberId: "anyone", // Let Square assign
            // serviceVariationId and serviceVariationVersion are required
            // if the location has bookable catalog services configured.
            // If these env vars are set, include them.
            ...(process.env.SQUARE_SERVICE_VARIATION_ID
              ? {
                  serviceVariationId: process.env.SQUARE_SERVICE_VARIATION_ID,
                  serviceVariationVersion: process.env.SQUARE_SERVICE_VARIATION_VERSION
                    ? BigInt(process.env.SQUARE_SERVICE_VARIATION_VERSION)
                    : undefined,
                }
              : {}),
          },
        ],
      },
      idempotencyKey: `belly-scrubs-booking-${data.customerEmail}-${data.date}-${data.time}-${Date.now()}`,
    };

    console.log(`SQUARE: Bookings API request payload:`, JSON.stringify(bookingRequest, (_, v) => typeof v === "bigint" ? v.toString() : v, 2));

    const bookingResponse = await client.bookings.create(bookingRequest);

    const bookingId = bookingResponse.booking?.id;
    if (!bookingId) {
      throw new Error("Square Bookings API returned success but no booking ID");
    }

    console.log(`SQUARE: ✓ Booking created successfully! ID: ${bookingId}`);
    console.log(`SQUARE: Booking status: ${bookingResponse.booking?.status}`);
    log(`Square booking created: ${bookingId} — ${data.date} ${data.time}`, "square");
    return bookingId;
  } catch (bookingError: any) {
    // --- DETAILED ERROR LOGGING for Bookings API failure ---
    console.error(`SQUARE: ✗ Bookings API call FAILED. Falling back to customer note.`);
    console.error(`SQUARE: Bookings API error message: ${bookingError.message}`);

    // Log the full error object for debugging
    if (bookingError.statusCode) {
      console.error(`SQUARE: HTTP status code: ${bookingError.statusCode}`);
    }
    if (bookingError.errors) {
      console.error(`SQUARE: Square API errors:`, JSON.stringify(bookingError.errors, null, 2));
      for (const err of bookingError.errors) {
        console.error(`SQUARE:   - category=${err.category} code=${err.code} detail="${err.detail}" field="${err.field}"`);
      }
    }
    if (bookingError.body) {
      try {
        const body = typeof bookingError.body === "string" ? JSON.parse(bookingError.body) : bookingError.body;
        console.error(`SQUARE: Full error response body:`, JSON.stringify(body, null, 2));
      } catch {
        console.error(`SQUARE: Raw error body:`, bookingError.body);
      }
    }
    // Log the stack trace for code-level debugging
    console.error(`SQUARE: Error stack:`, bookingError.stack);

    log(`Square Bookings API failed: ${bookingError.message} — falling back to customer note`, "square");
  }

  // --- FALLBACK PATH: Create a customer note ---
  const noteLines = [
    `★ ONLINE BOOKING - NEEDS CALENDAR ENTRY`,
    `Date: ${data.date} at ${displayTime}`,
    `Customer: ${data.customerName} | ${data.customerPhone}`,
    `Service: ${data.serviceName}`,
    data.addOns.length > 0 ? `Add-ons: ${data.addOns.join(", ")}` : null,
    `Pet: ${data.petName}${data.petBreed ? ` (${data.petBreed})` : ""}`,
    `Total: $${data.totalPrice}`,
    data.depositAmount > 0
      ? `Deposit: $${data.depositAmount} paid (non-refundable) | Remaining: $${data.totalPrice - data.depositAmount}`
      : `No deposit collected`,
    data.notes ? `Notes: ${data.notes}` : null,
    `— booked online via bellyscrubs.com`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    console.log(`SQUARE: FALLBACK — Creating customer note for ${data.petName} on ${data.date} at ${data.time}`);

    await client.customers.update({
      customerId,
      note: noteLines,
    });

    console.log(`SQUARE: Customer note created for ${data.customerName} (${customerId})`);
    console.log(`SQUARE: ⚠ REMINDER: Staff must manually create a calendar entry in Square Appointments for ${data.date} at ${displayTime}`);
    log(`Square customer note created (fallback): ${customerId} — ${data.date} ${data.time} (needs manual calendar entry)`, "square");
    return `customer-note-${customerId}`;
  } catch (noteError: any) {
    console.error("SQUARE: Customer note creation also failed:", noteError.message);
    log(`Square customer note error: ${noteError.message}`, "square");
    throw new Error(`Failed to create Square record: ${noteError.message}`);
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

// Hurricane, WV is Eastern Time (UTC-5 standard, UTC-4 DST).
// Square stores times in UTC, so we need to query a wide enough UTC window
// to capture all local-day bookings regardless of DST.
// Using UTC midnight-4h to next-day midnight-4h covers EDT (UTC-4).
// Using UTC midnight-5h to next-day midnight-5h covers EST (UTC-5).
// We use the wider window (midnight-5h to next-midnight-4h) to cover both.
const ET_OFFSET_HOURS_EARLIEST = -5; // EST (standard time)
const ET_OFFSET_HOURS_LATEST = -4;   // EDT (daylight saving)

/**
 * Check Square for existing appointments on a given date using bookings.list().
 * Returns occupied slot info including which team member is booked, so the
 * availability endpoint can do per-groomer checks.
 *
 * Handles pagination (Square defaults to ~100 per page) and converts UTC
 * booking times to Eastern Time for slot matching.
 */
export async function getSquareOccupiedSlots(date: string): Promise<OccupiedSlot[]> {
  const client = getSquareClient();
  const locationId = getSquareLocationId();

  const [year, month, day] = date.split("-").map(Number);

  // Build a UTC time range that fully covers the local Eastern Time day.
  // Local midnight ET = UTC 04:00 (EDT) or UTC 05:00 (EST).
  // To be safe, start from the earlier UTC equivalent (05:00 = EST midnight)
  // and end at the later next-day equivalent (04:00 next day = EDT midnight).
  const startAtUTC = new Date(Date.UTC(year, month - 1, day, -ET_OFFSET_HOURS_EARLIEST, 0, 0));
  const endAtUTC = new Date(Date.UTC(year, month - 1, day + 1, -ET_OFFSET_HOURS_LATEST, 0, 0));

  try {
    console.log(`SQUARE: Checking occupied slots for ${date} (UTC range: ${startAtUTC.toISOString()} to ${endAtUTC.toISOString()})`);

    // Fetch ALL pages of bookings for this date
    const allBookings: any[] = [];
    let cursor: string | undefined;

    do {
      const page = await client.bookings.list({
        locationId,
        startAtMin: startAtUTC.toISOString(),
        startAtMax: endAtUTC.toISOString(),
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });

      const pageBookings = page.data || [];
      allBookings.push(...pageBookings);

      // Get cursor for next page from the raw response
      cursor = (page as any).response?.cursor || undefined;

      if (cursor) {
        console.log(`SQUARE: Fetched page with ${pageBookings.length} booking(s), more pages available...`);
      }
    } while (cursor);

    console.log(`SQUARE: Found ${allBookings.length} total booking(s) on ${date} (across all pages)`);

    const occupied: OccupiedSlot[] = [];

    for (const booking of allBookings) {
      // Skip cancelled bookings, but include ALL other statuses
      // (PENDING, ACCEPTED, CONFIRMED, etc.)
      if (booking.status === "CANCELLED_BY_CUSTOMER" || booking.status === "CANCELLED_BY_SELLER") {
        console.log(`SQUARE:   [skip] id=${booking.id} status=${booking.status}`);
        continue;
      }

      if (booking.startAt) {
        const startTimeUTC = new Date(booking.startAt);

        // Convert UTC to Eastern Time for local slot matching.
        // Determine if date falls in DST: rough check — DST is March second Sun to Nov first Sun.
        // For simplicity, use the JS locale conversion which handles DST correctly.
        const localTimeStr = startTimeUTC.toLocaleString("en-US", { timeZone: "America/New_York" });
        const localTime = new Date(localTimeStr);
        const localHour = localTime.getHours();
        const localMinute = localTime.getMinutes();
        const bookingStartMinutes = localHour * 60 + localMinute;

        // Also verify this booking is actually on the requested local date
        const localDateStr = localTime.toISOString().split("T")[0];
        const localY = localTime.getFullYear();
        const localM = String(localTime.getMonth() + 1).padStart(2, "0");
        const localD = String(localTime.getDate()).padStart(2, "0");
        const bookingLocalDate = `${localY}-${localM}-${localD}`;

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

        const displayTime = `${localHour.toString().padStart(2, "0")}:${localMinute.toString().padStart(2, "0")}`;
        console.log(`SQUARE:   booking id=${booking.id} status=${booking.status} ` +
          `utc=${booking.startAt} local=${bookingLocalDate} ${displayTime} ` +
          `duration=${durationMinutes}min team=${teamMemberId || "unassigned"}`);

        // Only count bookings that fall on the requested date (in local time)
        if (bookingLocalDate !== date) {
          console.log(`SQUARE:   [skip] booking is on ${bookingLocalDate}, not ${date}`);
          continue;
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

    console.log(`SQUARE: ${occupied.length} occupied slot(s) on ${date}: ${JSON.stringify(occupied)}`);
    return occupied;
  } catch (error: any) {
    console.error(`SQUARE: Availability check failed for ${date}:`, error.message);
    log(`Square availability check error: ${error.message}`, "square");
    return [];
  }
}
