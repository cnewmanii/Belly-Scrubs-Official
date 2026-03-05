import type { Express, Request, Response } from "express";
import multer from "multer";
import { storage } from "../storage";
import { stripeEnabled } from "../index";

// CJS-compatible import for openai (ESM default import breaks in esbuild CJS output)
const openaiPkg = require("openai") as typeof import("openai");
const { OpenAI, toFile } = openaiPkg;

// p-limit is ESM-only — replace with a simple concurrency limiter
function pLimit(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  return <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        fn().then(resolve, reject).finally(() => {
          active--;
          if (queue.length > 0) queue.shift()!();
        });
      };
      if (active < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set — cannot generate calendar images");
  }
  return new OpenAI({ apiKey });
}

const CALENDAR_PRICE_CENTS = 2999;

/** Holiday/seasonal themes keyed by month number (1-12). */
const MONTH_THEMES: Record<number, { holiday: string; prompt: string }> = {
  1:  { holiday: "New Year's Day", prompt: "celebrating New Year's Day with party hats, confetti, and fireworks" },
  2:  { holiday: "Valentine's Day", prompt: "surrounded by hearts and roses for Valentine's Day, with a cute love theme" },
  3:  { holiday: "St. Patrick's Day", prompt: "wearing a tiny green hat for St. Patrick's Day, with shamrocks and gold" },
  4:  { holiday: "Easter", prompt: "with colorful Easter eggs and spring flowers, wearing bunny ears" },
  5:  { holiday: "Mother's Day", prompt: "with a bouquet of flowers for Mother's Day, in a soft spring setting" },
  6:  { holiday: "Summer Solstice", prompt: "playing at the beach on a sunny summer day, splashing in waves" },
  7:  { holiday: "Independence Day", prompt: "with American flags and fireworks for the 4th of July, patriotic and festive" },
  8:  { holiday: "National Pet Day", prompt: "playing happily outdoors on National Pet Day, wearing a colorful bandana" },
  9:  { holiday: "Back to School", prompt: "sitting next to school books and an apple, looking curious and studious" },
  10: { holiday: "Halloween", prompt: "wearing a cute Halloween costume with pumpkins and bats in the background" },
  11: { holiday: "Thanksgiving", prompt: "sitting at a cozy Thanksgiving table with autumn leaves, pumpkins, and harvest decorations" },
  12: { holiday: "Christmas", prompt: "wearing a Santa hat next to a decorated Christmas tree with wrapped presents and snowflakes" },
};

/** Build a rolling 12-month schedule starting from the current month. */
function getRolling12Months(): Array<{ month: number; year: number; holiday: string; prompt: string }> {
  const now = new Date();
  const startMonth = now.getMonth() + 1; // 1-indexed
  const startYear = now.getFullYear();
  const result: Array<{ month: number; year: number; holiday: string; prompt: string }> = [];

  for (let i = 0; i < 12; i++) {
    const m = ((startMonth - 1 + i) % 12) + 1; // 1-12
    const y = startYear + Math.floor((startMonth - 1 + i) / 12);
    const theme = MONTH_THEMES[m];
    result.push({ month: m, year: y, holiday: theme.holiday, prompt: theme.prompt });
  }
  return result;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const IMAGE_CONCURRENCY = 4;

async function generateMonthImages(calendarId: number, petName: string, petType: string, photoBuffer: Buffer) {
  console.log(`CALENDAR[${calendarId}]: Starting image generation for ${petName} (${petType}), 12 months`);
  await storage.updatePetCalendarStatus(calendarId, "generating");

  const rollingMonths = getRolling12Months();
  console.log(`CALENDAR[${calendarId}]: Rolling months: ${rollingMonths.map(m => `${m.month}/${m.year}`).join(", ")}`);

  const limit = pLimit(IMAGE_CONCURRENCY);
  let completedCount = 0;

  try {
    await Promise.all(
      rollingMonths.map((monthInfo) =>
        limit(async () => {
          try {
            const monthRow = await storage.createPetCalendarMonth(calendarId, monthInfo.month, monthInfo.year, monthInfo.holiday);

            const prompt = `A charming, high-quality digital illustration of a ${petType} named ${petName} ${monthInfo.prompt}. The ${petType} is the main subject, depicted in a warm and playful illustration style suitable for a wall calendar. Keep the pet's appearance consistent and adorable.`;

            console.log(`CALENDAR[${calendarId}]: Generating ${monthInfo.month}/${monthInfo.year} (${monthInfo.holiday})...`);

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
              // Store as base64 data URL directly in the database (Railway-compatible)
              const dataUrl = `data:image/png;base64,${base64}`;
              await storage.updatePetCalendarMonthImage(monthRow.id, dataUrl);
              completedCount++;
              console.log(`CALENDAR[${calendarId}]: ${monthInfo.month}/${monthInfo.year} complete (${completedCount}/12)`);
            } else {
              console.error(`CALENDAR[${calendarId}]: ${monthInfo.month}/${monthInfo.year} — OpenAI returned no b64_json data`);
            }
          } catch (err: any) {
            console.error(`CALENDAR[${calendarId}]: Error generating ${monthInfo.month}/${monthInfo.year}:`, err?.message || err);
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

// Track last retry attempt per calendar to prevent retry spam (every 3s poll)
const lastRetryAttempt = new Map<number, number>();
const RETRY_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

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
        const lastAttempt = lastRetryAttempt.get(id) || 0;
        const timeSinceRetry = Date.now() - lastAttempt;

        if (ageMs > TEN_MINUTES && timeSinceRetry > RETRY_COOLDOWN_MS) {
          console.log(`CALENDAR[${id}]: Stuck in "generating" for ${Math.round(ageMs / 60000)}min with 0 months — re-triggering`);
          lastRetryAttempt.set(id, Date.now());

          // Reset to pending and re-trigger generation
          await storage.updatePetCalendarStatus(id, "pending");
          status = "pending";

          // Re-trigger generation with stored photo data
          const photoBuffer = Buffer.from(calendar.photoData, "base64");
          generateMonthImages(id, calendar.petName, calendar.petType, photoBuffer).catch((err) => {
            console.error(`CALENDAR[${id}]: Re-triggered generation failed:`, err);
          });
        } else if (ageMs > TEN_MINUTES) {
          console.log(`CALENDAR[${id}]: Stuck but retry cooldown active (${Math.round(timeSinceRetry / 1000)}s / ${RETRY_COOLDOWN_MS / 1000}s) — skipping`);
        }
      }

      res.json({
        id: calendar.id,
        petName: calendar.petName,
        petType: calendar.petType,
        status,
        generatedCount,
        totalMonths: 12,
        months: months.sort((a, b) => a.year - b.year || a.month - b.month),
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
