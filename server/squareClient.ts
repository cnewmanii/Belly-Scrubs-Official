// Square SDK v44 uses SquareClient/SquareEnvironment (not Client/Environment).
// The CJS bundle loads via require("square"), so we use the CJS-compatible names.
const square = require("square") as typeof import("square");
const { SquareClient, SquareEnvironment } = square;

import { log } from "./index";
import { getQualifiedGroomers, isGroomerWorking, GROOMERS } from "./groomerConfig";

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

// ---------------------------------------------------------------------------
// Square Catalog — service variation lookup
// ---------------------------------------------------------------------------

export interface SquareCatalogService {
  name: string;              // e.g. "Basic Groom - Small Dog"
  variationId: string;       // Square catalog variation ID
  variationVersion: bigint;  // Square catalog variation version
  durationMinutes: number;   // Service duration from catalog
  categoryName: string;      // Parent item name, e.g. "Basic Groom"
}

/** In-memory catalog populated at startup by initSquareCatalog(). */
let catalogServices: SquareCatalogService[] = [];

/**
 * Fetch all APPOINTMENTS_SERVICE items from the Square Catalog and store them
 * in memory for booking lookups. Call once during server startup.
 */
export async function initSquareCatalog(): Promise<void> {
  const client = getSquareClient();
  const found: SquareCatalogService[] = [];
  let cursor: string | undefined;

  console.log("SQUARE CATALOG: Fetching bookable services...");

  do {
    const response = await client.catalog.list({
      types: "ITEM",
      ...(cursor ? { cursor } : {}),
    });

    for (const obj of response.data || []) {
      const itemData = obj.itemData;
      if (!itemData || itemData.productType !== "APPOINTMENTS_SERVICE") continue;

      const categoryName = itemData.name || "(unnamed)";

      for (const variation of itemData.variations || []) {
        const varData = variation.itemVariationData;
        const durationMs = varData?.serviceDuration;
        const durationMinutes = durationMs
          ? Math.round(Number(durationMs) / 60000)
          : 120; // default 2h if not set

        found.push({
          name: varData?.name || categoryName,
          variationId: variation.id || "unknown",
          variationVersion: variation.version ?? BigInt(0),
          durationMinutes,
          categoryName,
        });
      }
    }

    cursor = (response as any).cursor;
  } while (cursor);

  catalogServices = found;

  if (found.length === 0) {
    console.log("SQUARE CATALOG: No bookable services found in catalog.");
    console.log("SQUARE CATALOG: Create services in Square Dashboard > Appointments > Services");
  } else {
    console.log(`SQUARE CATALOG: Found ${found.length} service variation(s):`);
    for (const svc of found) {
      console.log(`  - "${svc.name}" (category="${svc.categoryName}") id=${svc.variationId} ver=${svc.variationVersion} dur=${svc.durationMinutes}min`);
    }
  }
}

/**
 * Match a website booking to a Square catalog service variation.
 *
 * Website sends:
 *   serviceId  = "basic-grooming" | "deluxe-grooming" | "cat-bath" | ...
 *   serviceName = "Deluxe Grooming Package - Medium (26-55 lbs), Short Hair"
 *
 * Square catalog has:
 *   categoryName = "Deluxe Groom - Medium Dog"   (parent item)
 *   name         = "Short Haired"                 (variation)
 *
 * Strategy:
 * 1. Parse serviceId → service type (basic/deluxe/cat-*)
 * 2. Parse serviceName → size (small/medium/large/extra large) + hair (short/long)
 * 3. Match service type + size against CATEGORY name
 * 4. Match hair type against VARIATION name
 */
export function lookupCatalogService(
  serviceId: string,
  serviceName: string,
): SquareCatalogService | null {
  if (catalogServices.length === 0) return null;

  const nameLC = serviceName.toLowerCase();
  const idLC = serviceId.toLowerCase();

  // --- Step 1: Determine service type keywords to match against category ---
  const categoryKeywords: Record<string, string[]> = {
    "basic-grooming": ["basic"],
    "deluxe-grooming": ["deluxe"],
    "cat-bath": ["cat bath"],
    "cat-groom": ["cat groom"],
    "cat-nail-trim": ["cat nail", "nail trim - cat"],
  };
  const typeKeywords = categoryKeywords[idLC];

  // --- Step 2: Extract size from serviceName ---
  // Match "Extra Large" first, then single words
  let size: string | null = null;
  if (nameLC.includes("extra large")) {
    size = "extra large";
  } else {
    const sizeMatch = nameLC.match(/\b(small|medium|large)\b/);
    size = sizeMatch ? sizeMatch[1] : null;
  }

  // --- Step 3: Extract hair type from serviceName ---
  let hairType: "short" | "long" | null = null;
  if (nameLC.includes("short hair")) {
    hairType = "short";
  } else if (nameLC.includes("long hair")) {
    hairType = "long";
  }

  const isCatService = idLC.startsWith("cat-");

  console.log(`SQUARE CATALOG: Parsing booking — serviceId="${serviceId}" serviceName="${serviceName}"`);
  console.log(`SQUARE CATALOG:   type=${typeKeywords ? typeKeywords.join("/") : "unknown"}, size=${size ?? "none"}, hair=${hairType ?? "none"}, isCat=${isCatService}`);

  // --- Step 4: Find matching catalog entry ---
  let bestMatch: SquareCatalogService | null = null;

  for (const svc of catalogServices) {
    const varLC = svc.name.toLowerCase();          // variation: "Short Haired", "Long Haired", "Regular"
    const catLC = svc.categoryName.toLowerCase();   // category:  "Deluxe Groom - Medium Dog"

    // 4a. Match service type against CATEGORY
    if (typeKeywords) {
      const matchesType = typeKeywords.some((kw) => catLC.includes(kw));
      if (!matchesType) continue;
    } else {
      // Unknown serviceId — try matching the id words against category
      const idWords = serviceId.replace(/-/g, " ");
      if (!catLC.includes(idWords)) continue;
    }

    // 4b. Match size against CATEGORY (dog services only)
    if (size) {
      if (!catLC.includes(size)) continue;
    } else if (!isCatService) {
      // Dog service without size info — can't match reliably
      continue;
    }

    // 4c. Match hair type against VARIATION name
    if (hairType) {
      if (!varLC.includes(hairType)) continue;
    } else if (!isCatService) {
      // Dog service without hair type — default to short
      if (!varLC.includes("short")) continue;
    }
    // Cat services: variation is "Regular", no hair filtering needed

    bestMatch = svc;
    break; // Exact match found
  }

  if (bestMatch) {
    console.log(`SQUARE CATALOG: ✓ Matched → variation="${bestMatch.name}" category="${bestMatch.categoryName}" (id=${bestMatch.variationId}, dur=${bestMatch.durationMinutes}min)`);
  } else {
    console.log(`SQUARE CATALOG: ✗ No match for serviceId="${serviceId}" serviceName="${serviceName}"`);
    console.log(`SQUARE CATALOG:   Available catalog entries:`);
    for (const svc of catalogServices) {
      console.log(`SQUARE CATALOG:     - variation="${svc.name}" category="${svc.categoryName}"`);
    }
  }

  return bestMatch;
}

export interface SquareAppointmentData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  petName: string;
  petBreed: string | null;
  serviceId: string;    // e.g. "basic-grooming", "cat-bath"
  serviceName: string;  // e.g. "Basic Grooming Package - Small (Up to 25 lbs), Short Hair"
  addOns: string[];
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24hr)
  totalPrice: number;
  depositAmount: number;
  notes: string | null;
  petPhotoUrl: string | null; // URL to the pre-groom photo on our server
}

/**
 * Pick an available team member for a booking by:
 * 1. Finding groomers qualified for the service
 * 2. Filtering to those working at the booked date/time
 * 3. Excluding those already booked at that slot (via Square occupied slots)
 * 4. Falling back to the first mapped groomer if no qualified one is free
 */
async function pickAvailableTeamMember(
  serviceId: string,
  serviceName: string,
  date: string,
  time: string,
): Promise<string> {
  // Extract pet size from serviceName for qualification check
  const nameLC = serviceName.toLowerCase();
  let petSize: string | undefined;
  if (nameLC.includes("extra large") || nameLC.includes("xl")) petSize = "XL";
  else if (nameLC.includes("large")) petSize = "Large";
  else if (nameLC.includes("medium")) petSize = "Medium";
  else if (nameLC.includes("small")) petSize = "Small";

  // Step 1: Get qualified groomers (already sorted with priority groomers first)
  const qualified = getQualifiedGroomers(serviceId, petSize);
  console.log(`SQUARE TEAM: Qualified groomers for ${serviceId} (${petSize || "any"}): [${qualified.map(g => g.displayName).join(", ")}]`);

  // Step 2: Filter to those working at this date/time
  const working = qualified.filter(g => isGroomerWorking(g.id, date, time));
  console.log(`SQUARE TEAM: Working at ${date} ${time}: [${working.map(g => g.displayName).join(", ")}]`);

  // Step 3: Filter to those with a mapped Square team member ID
  const mapped = working.filter(g => g.squareTeamMemberId);
  if (mapped.length === 0) {
    console.log(`SQUARE TEAM: No mapped groomers available — using first mapped groomer as fallback`);
    const fallback = GROOMERS.find(g => g.squareTeamMemberId);
    return fallback?.squareTeamMemberId || GROOMERS[0]?.squareTeamMemberId || "";
  }

  if (mapped.length === 1) {
    console.log(`SQUARE TEAM: Only one option: ${mapped[0].displayName} (${mapped[0].squareTeamMemberId})`);
    return mapped[0].squareTeamMemberId;
  }

  // Step 4: Check Square for existing bookings at this slot to avoid double-booking
  try {
    const occupiedSlots = await getSquareOccupiedSlots(date);
    const bookedAtSlot = occupiedSlots
      .filter(o => o.time === time && o.teamMemberId)
      .map(o => o.teamMemberId);

    const free = mapped.filter(g => !bookedAtSlot.includes(g.squareTeamMemberId));
    console.log(`SQUARE TEAM: Booked at ${time}: [${bookedAtSlot.join(", ")}], free: [${free.map(g => g.displayName).join(", ")}]`);

    if (free.length > 0) {
      console.log(`SQUARE TEAM: Selected ${free[0].displayName} (${free[0].squareTeamMemberId})`);
      return free[0].squareTeamMemberId;
    }
  } catch (err: any) {
    console.error(`SQUARE TEAM: Occupied slots check failed: ${err.message} — using first qualified groomer`);
  }

  // All qualified groomers appear booked — use the first mapped one anyway
  // (Square will reject if truly double-booked, and fallback path handles it)
  console.log(`SQUARE TEAM: All appear booked — defaulting to ${mapped[0].displayName}`);
  return mapped[0].squareTeamMemberId;
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
export interface SquareAppointmentResult {
  bookingId: string;
  invoiceId: string | null;
}

export async function createSquareAppointment(
  data: SquareAppointmentData
): Promise<SquareAppointmentResult> {
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

  // Append this booking's details + photo to the customer note in Square.
  // This builds a history so returning customers accumulate their visit log.
  try {
    await appendBookingToCustomerNote(client, customerId, data);
  } catch (noteErr: any) {
    // Non-fatal — don't block the booking if note update fails
    console.error(`SQUARE: Customer note update failed: ${noteErr.message}`);
  }

  // --- PRIMARY PATH: Create a real Square Booking ---
  try {
    console.log(`SQUARE: Attempting to create Bookings API appointment for ${data.petName} on ${data.date} at ${data.time}`);

    // Build the start time in UTC from the local Eastern Time date+time.
    // Hurricane, WV is Eastern Time (UTC-5 EST / UTC-4 EDT).
    // Use a fixed +5h offset (EST) — Square will normalize based on location timezone.
    const startAtISO = new Date(
      Date.UTC(
        parseInt(data.date.split("-")[0]),
        parseInt(data.date.split("-")[1]) - 1,
        parseInt(data.date.split("-")[2]),
        h + 5, // EST offset; Square normalizes based on location
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

    // Look up the matching Square catalog service for this booking
    const catalogMatch = lookupCatalogService(data.serviceId, data.serviceName);
    const durationMinutes = catalogMatch?.durationMinutes ?? 120;

    // --- Pick a real team member ID (Square rejects "anyone") ---
    const teamMemberId = await pickAvailableTeamMember(data.serviceId, data.serviceName, data.date, data.time);
    console.log(`SQUARE: Using teamMemberId=${teamMemberId} for booking`);

    const appointmentSegment: any = {
      durationMinutes,
      teamMemberId,
    };

    if (catalogMatch) {
      appointmentSegment.serviceVariationId = catalogMatch.variationId;
      appointmentSegment.serviceVariationVersion = catalogMatch.variationVersion;
      console.log(`SQUARE: Using catalog service "${catalogMatch.name}" (dur=${durationMinutes}min)`);
    } else {
      console.log(`SQUARE: No catalog match for "${data.serviceName}" — booking without serviceVariationId`);
    }

    const bookingRequest: any = {
      booking: {
        startAt: startAtISO,
        locationId,
        customerId,
        customerNote: bookingNote,
        appointmentSegments: [appointmentSegment],
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

    // Create invoice with deposit credit if a Stripe deposit was collected
    let invoiceId: string | null = null;
    if (data.depositAmount > 0) {
      try {
        invoiceId = await createSquareInvoice(
          customerId,
          locationId,
          data.serviceName,
          data.totalPrice,
          data.depositAmount,
          data.date,
          data.petName,
        );
      } catch (invoiceErr: any) {
        // Invoice failure should not block the booking
        console.error(`SQUARE INVOICE: Failed to create invoice: ${invoiceErr.message}`);
        log(`Square invoice creation failed: ${invoiceErr.message}`, "square");
      }
    }

    return { bookingId, invoiceId };
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
    console.log(`SQUARE: NOTE: Customer notes appear on the customer profile but NOT on the Square Appointments calendar.`);

    await client.customers.update({
      customerId,
      note: noteLines,
    });

    console.log(`SQUARE: Customer note created for ${data.customerName} (${customerId})`);
    console.log(`SQUARE: ⚠ REMINDER: Staff must manually create a calendar entry in Square Appointments for ${data.date} at ${displayTime}`);
    log(`Square customer note created (fallback): ${customerId} — ${data.date} ${data.time} (needs manual calendar entry)`, "square");
    return { bookingId: `customer-note-${customerId}`, invoiceId: null };
  } catch (noteError: any) {
    console.error("SQUARE: Customer note creation also failed:", noteError.message);
    log(`Square customer note error: ${noteError.message}`, "square");
    throw new Error(`Failed to create Square record: ${noteError.message}`);
  }
}

/**
 * Create a Square invoice for the remaining balance after a Stripe deposit.
 * The invoice shows the full service price with a discount line for the deposit.
 */
async function createSquareInvoice(
  customerId: string,
  locationId: string,
  serviceName: string,
  totalPrice: number,
  depositAmount: number,
  dueDate: string,
  petName: string,
): Promise<string> {
  const client = getSquareClient();
  const remainingBalance = totalPrice - depositAmount;

  console.log(`SQUARE INVOICE: Creating invoice for ${petName} — total=$${totalPrice}, deposit=$${depositAmount}, remaining=$${remainingBalance}`);

  // Step 1: Create an order with the service line item and deposit discount
  const orderResponse = await client.orders.create({
    order: {
      locationId,
      customerId,
      lineItems: [
        {
          name: `${serviceName} — ${petName}`,
          quantity: "1",
          basePriceMoney: {
            amount: BigInt(totalPrice * 100), // Convert dollars to cents
            currency: "USD",
          },
        },
      ],
      discounts: [
        {
          name: "Online deposit paid via Stripe (non-refundable)",
          amountMoney: {
            amount: BigInt(depositAmount * 100),
            currency: "USD",
          },
          scope: "ORDER",
        },
      ],
    },
    idempotencyKey: `belly-scrubs-invoice-order-${customerId}-${dueDate}-${Date.now()}`,
  });

  const orderId = orderResponse.order?.id;
  if (!orderId) {
    throw new Error("Square did not return an order ID for invoice");
  }
  console.log(`SQUARE INVOICE: Created order ${orderId}`);

  // Step 2: Create the invoice linked to the order
  const invoiceResponse = await client.invoices.create({
    invoice: {
      locationId,
      orderId,
      primaryRecipient: {
        customerId,
      },
      paymentRequests: [
        {
          requestType: "BALANCE",
          dueDate,
        },
      ],
      deliveryMethod: "SHARE_MANUALLY",
      title: `Grooming — ${petName}`,
      description: `${serviceName}\nDeposit of $${depositAmount} collected online. Remaining balance due at appointment.`,
    },
    idempotencyKey: `belly-scrubs-invoice-${customerId}-${dueDate}-${Date.now()}`,
  });

  const invoiceId = invoiceResponse.invoice?.id;
  if (!invoiceId) {
    throw new Error("Square did not return an invoice ID");
  }
  console.log(`SQUARE INVOICE: Created draft invoice ${invoiceId}`);

  // Step 3: Publish the invoice so it's visible in Square Dashboard
  const invoiceVersion = invoiceResponse.invoice?.version ?? 0;
  await client.invoices.publish({
    invoiceId,
    version: invoiceVersion,
    idempotencyKey: `belly-scrubs-invoice-publish-${invoiceId}-${Date.now()}`,
  });

  console.log(`SQUARE INVOICE: Published invoice ${invoiceId} — remaining balance $${remainingBalance} due ${dueDate}`);
  log(`Square invoice created: ${invoiceId} — $${remainingBalance} remaining (deposit $${depositAmount})`, "square");

  return invoiceId;
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

  console.log(`SQUARE CUSTOMER: Looking up customer — name="${name}" email="${email}" phone="${phone}"`);

  // Search for existing customer by email
  try {
    console.log(`SQUARE CUSTOMER: Searching by email: ${email}`);
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
      console.log(`SQUARE CUSTOMER: Found existing customer: ${searchResponse.customers[0].id} (${searchResponse.customers[0].givenName} ${searchResponse.customers[0].familyName})`);
      return searchResponse.customers[0].id!;
    }
    console.log("SQUARE CUSTOMER: No existing customer found, creating new...");
  } catch (searchErr: any) {
    console.error("SQUARE: Customer search failed:", searchErr.message);
    // Search failed, try creating
  }

  // Create new customer
  const nameParts = name.trim().split(/\s+/);
  const givenName = nameParts[0] || name;
  const familyName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  console.log(`SQUARE CUSTOMER: Creating new customer — givenName="${givenName}" familyName="${familyName || ""}" email="${email}" phone="${phone}"`);

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

  console.log(`SQUARE CUSTOMER: Created new customer: ${customerId}`);
  return customerId;
}

/**
 * Append booking info + pet photo link to the Square customer note.
 * Builds a running log so returning customers accumulate visit history.
 * Square customer notes are plain text (max ~65k chars), no file uploads.
 */
async function appendBookingToCustomerNote(
  client: SquareClientType,
  customerId: string,
  data: SquareAppointmentData,
): Promise<void> {
  // Fetch current customer to get existing note
  const customerResponse = await client.customers.get({ customerId });
  const existingNote = customerResponse.customer?.note || "";

  const [h, m] = data.time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const timeStr = `${dh}:${m.toString().padStart(2, "0")} ${ampm}`;

  const newEntry = [
    `--- Booking: ${data.date} at ${timeStr} ---`,
    `Pet: ${data.petName}${data.petBreed ? ` (${data.petBreed})` : ""}`,
    `Service: ${data.serviceName}`,
    data.addOns.length > 0 ? `Add-ons: ${data.addOns.join(", ")}` : null,
    data.notes ? `Notes: ${data.notes}` : null,
    data.petPhotoUrl ? `Pre-groom photo: ${data.petPhotoUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Append new entry to existing note (most recent at bottom)
  const updatedNote = existingNote
    ? `${existingNote}\n\n${newEntry}`
    : newEntry;

  await client.customers.update({
    customerId,
    note: updatedNote,
  });

  console.log(`SQUARE CUSTOMER: Updated note for ${customerId} with booking ${data.date} ${timeStr} + photo`);
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
