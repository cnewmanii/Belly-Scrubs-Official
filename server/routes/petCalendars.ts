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

/** Holiday/seasonal themes keyed by month number (1-12). Dramatic, over-the-top costumed scenes. */
const MONTH_THEMES: Record<number, { holiday: string; prompt: string }> = {
  1:  { holiday: "New Year's Day", prompt: "wearing a glittering gold tuxedo with a sequined bow tie and a \"Happy New Year\" sash, holding a champagne glass in one paw and a sparkling noisemaker in the other, standing on a rooftop party scene with confetti cannons exploding, golden balloons, streamers everywhere, a dazzling city skyline with fireworks bursting in brilliant colors across the midnight sky" },
  2:  { holiday: "Valentine's Day", prompt: "wearing a dapper red velvet suit with a pink ruffled shirt and heart-shaped sunglasses, holding a giant heart-shaped box of chocolates in one paw and a bouquet of long-stemmed red roses in the other, sitting on a plush pink velvet throne surrounded by floating heart balloons, rose petals scattered everywhere, a romantic candlelit backdrop with twinkling fairy lights" },
  3:  { holiday: "St. Patrick's Day", prompt: "wearing a full emerald green leprechaun suit with gold-buckled top hat, green velvet tailcoat, and a shamrock bow tie, holding a overflowing pot of gold coins in one paw and an ornate four-leaf clover cane in the other, standing on a lush green hillside with a vibrant double rainbow arching across the sky, gold coins scattered on the ground, clover fields stretching to the horizon" },
  4:  { holiday: "Easter", prompt: "wearing a pastel lavender Easter suit with a floral waistcoat and a bonnet decorated with spring flowers, holding a woven basket overflowing with ornate hand-painted Easter eggs in one paw and a giant chocolate bunny in the other, sitting in a blooming spring garden with cherry blossoms, tulips, daffodils, baby chicks, and decorated Easter eggs hidden among the flowers" },
  5:  { holiday: "Mother's Day", prompt: "wearing an elegant floral spring dress with a wide-brimmed sun hat decorated with fresh flowers, holding an enormous bouquet of peonies, roses, and lilies in both paws, standing in a gorgeous sunlit botanical garden with a white gazebo draped in wisteria, butterflies fluttering, a beautifully set tea table with fine china and a tiered cake in the background" },
  6:  { holiday: "Summer Solstice", prompt: "wearing a vibrant Hawaiian shirt with board shorts, flip-flops, and oversized aviator sunglasses, holding a colorful surfboard under one arm and a tropical drink with an umbrella in the other paw, standing on a pristine white sand beach with crystal turquoise waves, palm trees swaying, a brilliant golden sunset painting the sky in orange, pink, and purple" },
  7:  { holiday: "Independence Day", prompt: "wearing a full stars-and-stripes Uncle Sam outfit with a tall red-white-and-blue top hat, patriotic tailcoat, and star-spangled vest, holding lit sparklers blazing in both paws, standing proudly on a flag-draped stage with massive fireworks exploding in red, white, and blue across the night sky, American flags waving on both sides, bunting decorations everywhere" },
  8:  { holiday: "National Pet Day", prompt: "wearing a flashy golden Hollywood outfit with a star-studded cape, a jeweled crown, and a \"Best Pet\" award ribbon, holding a golden trophy in one paw and a royal scepter in the other, sitting on a red carpet with velvet ropes, paparazzi camera flashes, a Walk of Fame star with their name, spotlights beaming, and adoring fans in the background" },
  9:  { holiday: "Back to School", prompt: "wearing a preppy school uniform with a blazer, plaid tie, and a varsity letter sweater, holding a stack of textbooks in one paw and a shiny red apple in the other, sitting at a classic wooden school desk in a charming classroom with a green chalkboard covered in equations, a globe, school pennants on the walls, pencils, and a bright yellow school bus visible through the window" },
  10: { holiday: "Halloween", prompt: "wearing a dramatic vampire costume with a sweeping black and red cape, slicked-back hair, and gleaming fangs, holding a carved jack-o-lantern with an eerie glow in one paw and a trick-or-treat bucket overflowing with candy in the other, standing in a misty graveyard with crooked tombstones, a gnarled dead tree, bats flying across a giant glowing full moon, green fog rolling across the ground" },
  11: { holiday: "Thanksgiving", prompt: "wearing a full Pilgrim outfit with a buckled hat, white collar, and brown vest, holding a magnificent golden roasted turkey on a silver platter in both paws, standing at the head of a lavish Thanksgiving feast table loaded with pumpkin pie, cranberry sauce, cornucopia overflowing with autumn harvest, fall leaves in brilliant orange and red, a cozy log cabin with a roaring fireplace in the background" },
  12: { holiday: "Christmas", prompt: "wearing a complete Santa Claus suit with wide black belt, golden buckle, fur-trimmed boots, and a red hat with fluffy white pom-pom, holding a bulging sack of wrapped presents over one shoulder and a candy cane staff in the other paw, standing next to a magnificently decorated Christmas tree with glowing lights and ornaments, a stone fireplace with hung stockings, snow falling gently outside a frosted window, warm golden lighting" },
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

            const prompt = `Professional studio-quality portrait of a ${petType} named ${petName}, anthropomorphized and sitting upright, ${monthInfo.prompt}. CRITICAL: preserve the ${petType}'s exact face, fur coloring, breed features, and eye color from the reference photo — only add the costume and scene around them. Hyper-detailed, dramatic lighting, vivid saturated colors, shot with a high-end DSLR, suitable for a premium printed wall calendar. The ${petType} should look majestic and heroic in the scene.`;

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
