/**
 * Utility script to list all bookable services from Square Catalog.
 * Prints the service_variation_id and service_variation_version needed
 * for the SQUARE_SERVICE_VARIATION_ID / SQUARE_SERVICE_VARIATION_VERSION env vars.
 *
 * Usage: npx tsx scripts/get-square-services.ts
 * Requires: SQUARE_ACCESS_TOKEN environment variable
 */

import { SquareClient, SquareEnvironment } from "square";

const accessToken = process.env.SQUARE_ACCESS_TOKEN;
if (!accessToken) {
  console.error("ERROR: SQUARE_ACCESS_TOKEN environment variable is required.");
  console.error("Set it with: export SQUARE_ACCESS_TOKEN=your_token_here");
  process.exit(1);
}

const client = new SquareClient({
  token: accessToken,
  environment: SquareEnvironment.Production,
});

async function main() {
  console.log("Fetching catalog items from Square...\n");

  // List all ITEM types from the catalog, then filter for appointment services
  let cursor: string | undefined;
  const serviceItems: Array<{
    itemName: string;
    variationId: string;
    variationName: string;
    variationVersion: string;
  }> = [];

  do {
    const response = await client.catalog.list({
      types: "ITEM",
      ...(cursor ? { cursor } : {}),
    });

    for (const obj of response.data || []) {
      // Check if this item is an appointments service
      const itemData = obj.itemData;
      if (!itemData) continue;

      // Square marks appointment service items with productType = "APPOINTMENTS_SERVICE"
      if (itemData.productType !== "APPOINTMENTS_SERVICE") continue;

      const itemName = itemData.name || "(unnamed)";

      // Each item can have multiple variations
      for (const variation of itemData.variations || []) {
        serviceItems.push({
          itemName,
          variationName: variation.itemVariationData?.name || "(default)",
          variationId: variation.id || "unknown",
          variationVersion: variation.version?.toString() || "unknown",
        });
      }
    }

    cursor = (response as any).cursor;
  } while (cursor);

  if (serviceItems.length === 0) {
    console.log("No bookable services found.\n");
    console.log("Create one in Square Dashboard > Appointments > Services");
    console.log("https://squareup.com/dashboard/appointments/services\n");
    console.log("After creating a service, re-run this script to get the IDs.");
    process.exit(0);
  }

  console.log(`Found ${serviceItems.length} bookable service variation(s):\n`);

  for (const svc of serviceItems) {
    const label = svc.variationName !== "(default)" && svc.variationName !== svc.itemName
      ? `${svc.itemName} — ${svc.variationName}`
      : svc.itemName;

    console.log(`SERVICE: "${label}"`);
    console.log(`  SQUARE_SERVICE_VARIATION_ID=${svc.variationId}`);
    console.log(`  SQUARE_SERVICE_VARIATION_VERSION=${svc.variationVersion}`);
    console.log();
  }

  console.log("Add these to your .env file to enable direct Bookings API integration.");
}

main().catch((err) => {
  console.error("Failed to fetch catalog:", err.message);
  if (err.errors) {
    for (const e of err.errors) {
      console.error(`  - ${e.code}: ${e.detail}`);
    }
  }
  process.exit(1);
});
