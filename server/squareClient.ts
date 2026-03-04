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
// Service Catalog Lookup
// ---------------------------------------------------------------------------

/** Cached service variation ID — looked up once at startup */
let cachedServiceVariationId: string | null = null;

/**
 * Find a bookable service variation in the Square catalog.
 * searchAvailability requires a serviceVariationId, so we look up whatever
 * service is configured in Square Appointments for this location.
 */
export async function lookupSquareServiceVariation(): Promise<string | null> {
  if (cachedServiceVariationId) return cachedServiceVariationId;

  const client = getSquareClient();

  try {
    console.log("SQUARE: Looking up bookable service variations in catalog...");
    const response = await client.catalog.search({
      objectTypes: ["ITEM_VARIATION"],
      query: {
        exactQuery: {
          attributeName: "is_bookable",
          attributeValue: "true",
        },
      },
    });

    // If exact query doesn't return results, list all ITEM types and check
    let variationId: string | null = null;

    if (response.objects && response.objects.length > 0) {
      const obj = response.objects[0];
      variationId = obj.id || null;
      console.log(`SQUARE: Found bookable service variation: ${variationId} (${obj.type})`);
    }

    if (!variationId) {
      // Fallback: search for ITEM type objects that look like services
      console.log("SQUARE: No bookable variation found via exact query, trying item search...");
      const itemPage = await client.catalog.list({
        types: "ITEM",
      });

      for (const item of itemPage.data || []) {
        const variations = (item as any).itemData?.variations;
        if (variations && variations.length > 0) {
          // Check if any variation is bookable (has serviceDuration set)
          for (const v of variations) {
            const vData = v.itemVariationData;
            if (vData?.serviceDuration || vData?.availableForBooking) {
              variationId = v.id;
              console.log(`SQUARE: Found service variation via catalog scan: ${variationId} (${vData?.name || "unnamed"})`);
              break;
            }
          }
          if (variationId) break;
        }
      }
    }

    if (variationId) {
      cachedServiceVariationId = variationId;
      console.log(`SQUARE: Service variation ID cached: ${variationId}`);
    } else {
      console.log("SQUARE: No bookable service variation found in catalog — searchAvailability won't be usable");
    }

    return variationId;
  } catch (error: any) {
    console.error("SQUARE: Service catalog lookup failed:", error.message);
    log(`Square catalog lookup error: ${error.message}`, "square");
    return null;
  }
}

// ---------------------------------------------------------------------------
// searchAvailability — the primary availability check
// ---------------------------------------------------------------------------

export interface SquareAvailableSlot {
  time: string;                // "HH:MM" fixed slot time
  teamMemberIds: string[];     // team members available at this slot
}

/**
 * Use Square's searchAvailability API to get REAL available time windows.
 * This is the single source of truth — it accounts for:
 *   - All existing appointments (API-created AND manually-created)
 *   - Team member schedules, days off, modified hours
 *   - Business hours and booking rules
 *
 * Returns which of our fixed slots have availability and which team members
 * are free at each slot. Returns null if searchAvailability can't be used
 * (e.g. no service variation configured), signaling caller to use fallback.
 */
export async function getSquareAvailability(
  date: string,
  teamMemberIds?: string[],
): Promise<SquareAvailableSlot[] | null> {
  const client = getSquareClient();
  const locationId = getSquareLocationId();
  const serviceVariationId = await lookupSquareServiceVariation();

  if (!serviceVariationId) {
    console.log("SQUARE: searchAvailability skipped — no serviceVariationId");
    return null;
  }

  const [year, month, day] = date.split("-").map(Number);
  // searchAvailability needs a range of at least 24 hours
  const startAt = new Date(year, month - 1, day, 0, 0, 0).toISOString();
  const endAt = new Date(year, month - 1, day + 1, 0, 0, 0).toISOString();

  try {
    console.log(`SQUARE: searchAvailability for ${date}, service=${serviceVariationId}, ` +
      `teamMembers=${teamMemberIds ? teamMemberIds.join(",") : "any"}`);

    const segmentFilter: any = {
      serviceVariationId,
    };
    if (teamMemberIds && teamMemberIds.length > 0) {
      segmentFilter.teamMemberIdFilter = { any: teamMemberIds };
    }

    const response = await client.bookings.searchAvailability({
      query: {
        filter: {
          startAtRange: { startAt, endAt },
          locationId,
          segmentFilters: [segmentFilter],
        },
      },
    });

    const availabilities = response.availabilities || [];
    console.log(`SQUARE: searchAvailability returned ${availabilities.length} available window(s) on ${date}`);

    // Map Square's available windows to our fixed slots
    const result: SquareAvailableSlot[] = [];

    for (const fixedSlot of FIXED_SLOTS) {
      const slotStartMinutes = fixedSlot.minutes;
      const teamMembersAtSlot: string[] = [];

      for (const avail of availabilities) {
        if (!avail.startAt) continue;
        const availTime = new Date(avail.startAt);
        const availMinutes = availTime.getHours() * 60 + availTime.getMinutes();

        // An availability window matches our fixed slot if it starts at the slot time
        // (Square returns individual start times, not ranges)
        if (availMinutes === slotStartMinutes) {
          // Collect team member IDs from appointment segments
          for (const seg of avail.appointmentSegments || []) {
            if (seg.teamMemberId && seg.teamMemberId !== "anyone") {
              teamMembersAtSlot.push(seg.teamMemberId);
            }
          }
        }
      }

      result.push({
        time: fixedSlot.time,
        teamMemberIds: teamMembersAtSlot,
      });
    }

    for (const slot of result) {
      console.log(`SQUARE: slot ${slot.time} → ${slot.teamMemberIds.length} available team member(s): [${slot.teamMemberIds.join(", ")}]`);
    }

    return result;
  } catch (error: any) {
    console.error(`SQUARE: searchAvailability failed for ${date}:`, error.message);
    log(`Square searchAvailability error: ${error.message}`, "square");
    return null;
  }
}

// ---------------------------------------------------------------------------
// getSquareOccupiedSlots — FALLBACK when searchAvailability is unavailable
// ---------------------------------------------------------------------------

/**
 * Check Square for existing appointments on a given date using bookings.list().
 * Returns occupied slot info including which team member is booked.
 *
 * NOTE: This is the FALLBACK method. bookings.list() may not return manually-
 * created appointments (only API-created ones). Prefer getSquareAvailability()
 * which uses searchAvailability and accounts for ALL appointments + schedules.
 */
export async function getSquareOccupiedSlots(date: string): Promise<OccupiedSlot[]> {
  const client = getSquareClient();
  const locationId = getSquareLocationId();

  const [year, month, day] = date.split("-").map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59);

  try {
    console.log(`SQUARE: [FALLBACK] Checking occupied slots via bookings.list for ${date}`);
    const page = await client.bookings.list({
      locationId,
      startAtMin: startOfDay.toISOString(),
      startAtMax: endOfDay.toISOString(),
    });

    const occupied: OccupiedSlot[] = [];
    const bookings = page.data || [];
    console.log(`SQUARE: [FALLBACK] Found ${bookings.length} booking(s) on ${date}`);

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
    console.error(`SQUARE: [FALLBACK] Availability check failed for ${date}:`, error.message);
    log(`Square availability check error: ${error.message}`, "square");
    return [];
  }
}
