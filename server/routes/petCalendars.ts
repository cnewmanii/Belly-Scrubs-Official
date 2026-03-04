import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { toFile } from "openai";
import pLimit from "p-limit";
import { storage } from "../storage";
import { stripeEnabled } from "../index";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set — cannot generate calendar images");
  }
  return new OpenAI({ apiKey });
}

const CALENDAR_PRICE_CENTS = 2999;

const MONTHS = [
  { month: 1, holiday: "New Year's Day", prompt: "celebrating New Year's Day with party hats, confetti, and fireworks" },
  { month: 2, holiday: "Valentine's Day", prompt: "surrounded by hearts and roses for Valentine's Day, with a cute love theme" },
  { month: 3, holiday: "St. Patrick's Day", prompt: "wearing a tiny green hat for St. Patrick's Day, with shamrocks and gold" },
  { month: 4, holiday: "Easter", prompt: "with colorful Easter eggs and spring flowers, wearing bunny ears" },
  { month: 5, holiday: "Mother's Day", prompt: "with a bouquet of flowers for Mother's Day, in a soft spring setting" },
  { month: 6, holiday: "Summer Solstice", prompt: "playing at the beach on a sunny summer day, splashing in waves" },
  { month: 7, holiday: "Independence Day", prompt: "with American flags and fireworks for the 4th of July, patriotic and festive" },
  { month: 8, holiday: "National Pet Day", prompt: "playing happily outdoors on National Pet Day, wearing a colorful bandana" },
  { month: 9, holiday: "Back to School", prompt: "sitting next to school books and an apple, looking curious and studious" },
  { month: 10, holiday: "Halloween", prompt: "wearing a cute Halloween costume with pumpkins and bats in the background" },
  { month: 11, holiday: "Thanksgiving", prompt: "sitting at a cozy Thanksgiving table with autumn leaves, pumpkins, and harvest decorations" },
  { month: 12, holiday: "Christmas", prompt: "wearing a Santa hat next to a decorated Christmas tree with wrapped presents and snowflakes" },
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const IMAGE_CONCURRENCY = 4;

async function generateMonthImages(calendarId: number, petName: string, petType: string, photoBuffer: Buffer) {
  console.log(`CALENDAR[${calendarId}]: Starting image generation for ${petName} (${petType}), 12 months`);
  await storage.updatePetCalendarStatus(calendarId, "generating");

  const genDir = path.join(process.cwd(), "client", "public", "generated", String(calendarId));
  fs.mkdirSync(genDir, { recursive: true });
  console.log(`CALENDAR[${calendarId}]: Output directory created: ${genDir}`);

  const limit = pLimit(IMAGE_CONCURRENCY);
  let completedCount = 0;

  try {
    await Promise.all(
      MONTHS.map((monthInfo) =>
        limit(async () => {
          try {
            const monthRow = await storage.createPetCalendarMonth(calendarId, monthInfo.month, monthInfo.holiday);

            const prompt = `A charming, high-quality digital illustration of a ${petType} named ${petName} ${monthInfo.prompt}. The ${petType} is the main subject, depicted in a warm and playful illustration style suitable for a wall calendar. Keep the pet's appearance consistent and adorable.`;

            console.log(`CALENDAR[${calendarId}]: Generating month ${monthInfo.month} (${monthInfo.holiday})...`);

            const imageFile = await toFile(photoBuffer, "pet.png", { type: "image/png" });
            const openai = getOpenAIClient();

            const response = await openai.images.edit({
              model: "gpt-image-1",
              image: imageFile,
              prompt,
              n: 1,
              size: "1024x1024",
            });

            const base64 = response.data[0]?.b64_json;
            if (base64) {
              const imgPath = path.join(genDir, `${monthInfo.month}.png`);
              fs.writeFileSync(imgPath, Buffer.from(base64, "base64"));
              await storage.updatePetCalendarMonthImage(monthRow.id, `/generated/${calendarId}/${monthInfo.month}.png`);
              completedCount++;
              console.log(`CALENDAR[${calendarId}]: Month ${monthInfo.month} complete (${completedCount}/12)`);
            } else {
              console.error(`CALENDAR[${calendarId}]: Month ${monthInfo.month} — OpenAI returned no b64_json data`);
            }
          } catch (err: any) {
            console.error(`CALENDAR[${calendarId}]: Error generating month ${monthInfo.month}:`, err?.message || err);
            console.error(`CALENDAR[${calendarId}]: Full error:`, JSON.stringify(err, Object.getOwnPropertyNames(err || {}), 2));
          }
        })
      )
    );

    console.log(`CALENDAR[${calendarId}]: All 12 months done. ${completedCount} succeeded.`);
    await storage.updatePetCalendarStatus(calendarId, "ready");
  } catch (err: any) {
    console.error(`CALENDAR[${calendarId}]: Fatal error in generateMonthImages:`, err?.message || err);
    await storage.updatePetCalendarStatus(calendarId, "error");
  }
}

export function registerPetCalendarRoutes(app: Express) {
  app.post("/api/pet-calendars", upload.single("photo"), async (req: Request, res: Response) => {
    try {
      const { petName, petType } = req.body;
      if (!petName || !petType || !req.file) {
        return res.status(400).json({ error: "Missing petName, petType, or photo" });
      }

      const photoBase64 = req.file.buffer.toString("base64");

      const calendar = await storage.createPetCalendar({
        petName,
        petType,
        photoData: photoBase64,
      });

      generateMonthImages(calendar.id, petName, petType, req.file.buffer).catch(console.error);

      res.json({ id: calendar.id });
    } catch (err) {
      console.error("Calendar creation error:", err instanceof Error ? err.stack : err);
      res.status(500).json({ error: "Failed to create calendar" });
    }
  });

  app.get("/api/pet-calendars/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const calendar = await storage.getPetCalendar(id);
      if (!calendar) return res.status(404).json({ error: "Calendar not found" });

      const months = await storage.getPetCalendarMonths(id);
      const generatedCount = await storage.getGeneratedMonthCount(id);

      // Detect stuck calendars: "generating" for >10 min with 0 generated months
      // This handles orphaned generation from a previous deploy
      let status = calendar.status;
      if (status === "generating" && generatedCount === 0 && calendar.createdAt) {
        const ageMs = Date.now() - new Date(calendar.createdAt).getTime();
        const TEN_MINUTES = 10 * 60 * 1000;
        if (ageMs > TEN_MINUTES) {
          console.log(`CALENDAR[${id}]: Stuck in "generating" for ${Math.round(ageMs / 60000)}min with 0 months — re-triggering`);
          // Reset to pending and re-trigger generation
          await storage.updatePetCalendarStatus(id, "pending");
          status = "pending";

          // Re-trigger generation with stored photo data
          const photoBuffer = Buffer.from(calendar.photoData, "base64");
          generateMonthImages(id, calendar.petName, calendar.petType, photoBuffer).catch((err) => {
            console.error(`CALENDAR[${id}]: Re-triggered generation failed:`, err);
          });
        }
      }

      res.json({
        id: calendar.id,
        petName: calendar.petName,
        petType: calendar.petType,
        status,
        generatedCount,
        totalMonths: 12,
        months: months.sort((a, b) => a.month - b.month),
      });
    } catch (err) {
      console.error("Calendar fetch error:", err instanceof Error ? err.stack : err);
      res.status(500).json({ error: "Failed to fetch calendar" });
    }
  });

  app.post("/api/pet-calendars/:id/checkout", async (req: Request, res: Response) => {
    if (!stripeEnabled) return res.status(503).json({ error: "Payments not configured" });
    try {
      const calendarId = parseInt(req.params.id, 10);
      const { email } = req.body;

      const calendar = await storage.getPetCalendar(calendarId);
      if (!calendar) return res.status(404).json({ error: "Calendar not found" });
      if (calendar.status !== "ready") return res.status(400).json({ error: "Calendar not ready" });

      const { getUncachableStripeClient } = await import("../stripeClient");
      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${req.get("host")}`;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${calendar.petName}'s Holiday Calendar`,
                description: "12 AI-generated holiday-themed images of your pet",
              },
              unit_amount: CALENDAR_PRICE_CENTS,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: email || undefined,
        success_url: `${baseUrl}/pet-calendar/success?session_id={CHECKOUT_SESSION_ID}&calendar_id=${calendarId}`,
        cancel_url: `${baseUrl}/pet-calendar/${calendarId}`,
        metadata: {
          calendarId: String(calendarId),
        },
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error("Checkout error:", err);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.get("/api/checkout/verify", async (req: Request, res: Response) => {
    if (!stripeEnabled) return res.status(503).json({ error: "Payments not configured" });
    try {
      const { session_id, calendar_id } = req.query;
      if (!session_id || !calendar_id) return res.status(400).json({ error: "Missing params" });

      const { getUncachableStripeClient } = await import("../stripeClient");
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(session_id as string);

      if (session.payment_status === "paid") {
        await storage.updatePetCalendarPurchased(
          parseInt(calendar_id as string),
          session_id as string,
          session.customer_email || ""
        );
        const calendar = await storage.getPetCalendar(parseInt(calendar_id as string));
        const months = await storage.getPetCalendarMonths(parseInt(calendar_id as string));
        return res.json({ success: true, calendar: { ...calendar, months: months.sort((a, b) => a.month - b.month) } });
      }

      res.json({ success: false });
    } catch (err) {
      console.error("Verify error:", err);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });
}
