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

/**
 * Holiday/seasonal themes keyed by month number (1-12).
 * Each month has multiple prompt variants so every calendar is unique.
 * Prompts use {{HE_SHE}}, {{HIS_HER}}, {{HIM_HER}} placeholders for gendered language.
 */
const MONTH_THEMES: Record<number, { holiday: string; prompts: string[]; maleHoliday?: string; malePrompts?: string[] }> = {
  1: { holiday: "New Year's Day", prompts: [
    "wearing a glittering gold tuxedo with a sequined bow tie and a \"Happy New Year\" sash, holding a champagne glass in one paw and a sparkling noisemaker in the other, standing on a rooftop party scene with confetti cannons exploding, golden balloons, streamers everywhere, a dazzling city skyline with fireworks bursting in brilliant colors across the midnight sky",
    "wearing a shimmering silver cocktail outfit with a feathered headband and elbow-length gloves, popping a giant bottle of champagne with golden fizz spraying everywhere, standing inside a luxurious ballroom with crystal chandeliers, a massive glitter ball, art-deco decorations, and a countdown clock striking midnight",
    "wearing a regal midnight-blue velvet cape with silver star embroidery and a diamond-encrusted party crown, ringing an enormous golden bell with both paws, standing at the top of a grand marble staircase as thousands of paper lanterns float into the starry night sky, fireworks reflecting in {{HIS_HER}} eyes",
  ]},
  2: { holiday: "Valentine's Day", prompts: [
    "wearing a dapper red velvet suit with a pink ruffled shirt and heart-shaped sunglasses, holding a giant heart-shaped box of chocolates in one paw and a bouquet of long-stemmed red roses in the other, sitting on a plush pink velvet throne surrounded by floating heart balloons, rose petals scattered everywhere, a romantic candlelit backdrop with twinkling fairy lights",
    "wearing an elegant pink ball gown with cascading ruffles and a sparkling heart locket, surrounded by a whirlwind of red and pink rose petals, standing on a Venetian bridge over a shimmering canal with gondolas, heart-shaped lanterns floating in the evening sky, cupid statues on either side",
    "wearing a charming red-and-white striped waistcoat with a bow tie made of tiny roses, sitting at a cozy Parisian café table set for two with macarons and hot cocoa, the Eiffel Tower glowing pink in the background, heart-shaped confetti falling gently from above",
  ]},
  3: { holiday: "St. Patrick's Day", prompts: [
    "wearing a full emerald green leprechaun suit with gold-buckled top hat, green velvet tailcoat, and a shamrock bow tie, holding an overflowing pot of gold coins in one paw and an ornate four-leaf clover cane in the other, standing on a lush green hillside with a vibrant double rainbow arching across the sky, gold coins scattered on the ground, clover fields stretching to the horizon",
    "wearing a fancy green tartan kilt with a jeweled clover brooch and a feathered cap, doing a joyful Irish jig on top of a giant mushroom in an enchanted forest, gold coins raining from a magical rainbow overhead, tiny leprechaun houses tucked among glowing moss and shamrocks",
    "wearing a dashing emerald velvet smoking jacket with gold cufflinks and a top hat overflowing with clovers, lounging on a throne of stacked gold coins inside a hidden cave, rivers of gold cascading like waterfalls, glowing green crystals lining the cavern walls, a magical rainbow entering through the cave mouth",
  ]},
  4: { holiday: "Easter", prompts: [
    "wearing a pastel lavender Easter suit with a floral waistcoat and a bonnet decorated with spring flowers, holding a woven basket overflowing with ornate hand-painted Easter eggs in one paw and a giant chocolate bunny in the other, sitting in a blooming spring garden with cherry blossoms, tulips, daffodils, baby chicks, and decorated Easter eggs hidden among the flowers",
    "wearing a sunny yellow spring outfit with a daisy-chain crown and pastel rainbow suspenders, riding in a giant decorated Easter egg like a chariot pulled by fluffy bunnies through a meadow of wildflowers, butterflies everywhere, a pastel sky with cotton-candy clouds",
    "wearing an elegant cream-colored linen suit with a pastel plaid vest and a fresh flower boutonnière, hosting a grand Easter egg hunt in a manicured English garden, standing next to an enormous tower of colorfully decorated eggs, baby lambs frolicking, wisteria arches overhead",
  ]},
  5: { holiday: "Mother's Day", prompts: [
    "wearing an elegant floral spring dress with a wide-brimmed sun hat decorated with fresh flowers, holding an enormous bouquet of peonies, roses, and lilies in both paws, standing in a gorgeous sunlit botanical garden with a white gazebo draped in wisteria, butterflies fluttering, a beautifully set tea table with fine china and a tiered cake in the background",
    "wearing a chic pastel pantsuit with a corsage of fresh gardenias, sitting in a luxurious wicker chair on a sunlit veranda, surrounded by hanging flower baskets and potted orchids, a lace-covered table with a stack of beautifully wrapped gifts and a \"Best Mom\" trophy, hummingbirds visiting nearby blooms",
    "wearing a flowing silk kimono-inspired robe with hand-painted cherry blossoms, holding a delicate porcelain teacup in one paw, relaxing in a serene Japanese zen garden with a koi pond, stepping stones, blooming azaleas, and a wooden bridge, soft morning light filtering through maple trees",
  ], maleHoliday: "Father's Day", malePrompts: [
    "wearing a sharp navy blazer with a pocket square and a \"World's Best Dad\" tie, holding a shiny set of BBQ tongs in one paw and a cold lemonade in the other, standing proudly next to a smoking grill loaded with burgers and hot dogs in a sunny backyard, a hammock strung between oak trees, lawn games set up on the grass, a cooler full of drinks nearby",
    "wearing a classic leather bomber jacket with aviator sunglasses and a vintage baseball cap, leaning against a beautifully restored muscle car with a gleaming chrome finish, tools neatly arranged on a garage workbench behind {{HIM_HER}}, an open road stretching into a golden sunset, a \"#1 Dad\" bumper sticker on the car",
    "wearing a rugged flannel shirt with rolled-up sleeves, a fishing vest covered in lures, and a wide-brimmed outdoorsman hat, holding an enormous trophy fish in both paws with a proud grin, standing on a wooden dock at a peaceful mountain lake at sunrise, a tackle box and fishing rod beside {{HIM_HER}}, pine-covered mountains reflected in the still water",
  ]},
  6: { holiday: "Summer Solstice", prompts: [
    "wearing a vibrant Hawaiian shirt with board shorts, flip-flops, and oversized aviator sunglasses, holding a colorful surfboard under one arm and a tropical drink with an umbrella in the other paw, standing on a pristine white sand beach with crystal turquoise waves, palm trees swaying, a brilliant golden sunset painting the sky in orange, pink, and purple",
    "wearing a stylish nautical captain's outfit with a white blazer, gold epaulettes, and a captain's hat, standing at the wheel of a gleaming yacht on sparkling azure waters, dolphins jumping alongside, a tropical island paradise visible in the distance, golden sun overhead",
    "wearing a retro 1960s pool party outfit with cat-eye sunglasses and a colorful sarong, floating on a giant flamingo pool float in a sparkling turquoise infinity pool overlooking the ocean, tiki torches lit around the deck, tropical cocktails on a floating tray, palm trees swaying in a warm breeze",
  ]},
  7: { holiday: "Independence Day", prompts: [
    "wearing a full stars-and-stripes Uncle Sam outfit with a tall red-white-and-blue top hat, patriotic tailcoat, and star-spangled vest, holding lit sparklers blazing in both paws, standing proudly on a flag-draped stage with massive fireworks exploding in red, white, and blue across the night sky, American flags waving on both sides, bunting decorations everywhere",
    "wearing a patriotic red-white-and-blue bomber jacket with star patches and aviator goggles, riding on the wing of a vintage biplane doing a flyover as red, white, and blue smoke trails paint the sky, a massive crowd cheering below at a Fourth of July festival, fireworks beginning to burst at dusk",
    "wearing a star-spangled rodeo outfit with a red-white-and-blue cowboy hat, fringed vest, and silver belt buckle shaped like an eagle, riding a mechanical bull at a county fair with ferris wheels, cotton candy stands, sparklers, and a spectacular fireworks display lighting up the twilight sky",
  ]},
  8: { holiday: "National Pet Day", prompts: [
    "wearing a flashy golden Hollywood outfit with a star-studded cape, a jeweled crown, and a \"Best Pet\" award ribbon, holding a golden trophy in one paw and a royal scepter in the other, sitting on a red carpet with velvet ropes, paparazzi camera flashes, a Walk of Fame star with {{HIS_HER}} name, spotlights beaming, and adoring fans in the background",
    "wearing a superhero costume with a flowing cape, a custom emblem on {{HIS_HER}} chest, and a mask, striking a heroic pose on top of a skyscraper at sunset, the city skyline glowing behind {{HIM_HER}}, a spotlight shining {{HIS_HER}} symbol in the clouds, confetti and streamers swirling in the wind",
    "wearing a luxurious royal purple robe with ermine trim and a golden crown studded with gems, sitting on an ornate golden throne in a grand palace hall, velvet cushions everywhere, servants presenting platters of gourmet treats, a stained-glass window casting colorful light patterns across the marble floor",
  ]},
  9: { holiday: "Back to School", prompts: [
    "wearing a preppy school uniform with a blazer, plaid tie, and a varsity letter sweater, holding a stack of textbooks in one paw and a shiny red apple in the other, sitting at a classic wooden school desk in a charming classroom with a green chalkboard covered in equations, a globe, school pennants on the walls, pencils, and a bright yellow school bus visible through the window",
    "wearing a graduation cap and gown with honors cords and a diploma in one paw, tossing {{HIS_HER}} cap in the air with the other, standing on a grand university campus with ivy-covered brick buildings, a clock tower, falling autumn leaves in warm colors, other graduates celebrating in the background",
    "wearing a mad-scientist lab coat with wild goggles, surrounded by bubbling beakers and colorful chemistry experiments in a fantastical laboratory, an erupting volcano science project on the table, equations floating in the air, shelves of curiosities, and a robot {{HE_SHE}} built standing beside {{HIM_HER}}",
  ]},
  10: { holiday: "Halloween", prompts: [
    "wearing a dramatic vampire costume with a sweeping black and red cape, slicked-back hair, and gleaming fangs, holding a carved jack-o-lantern with an eerie glow in one paw and a trick-or-treat bucket overflowing with candy in the other, standing in a misty graveyard with crooked tombstones, a gnarled dead tree, bats flying across a giant glowing full moon, green fog rolling across the ground",
    "wearing an elaborate witch or wizard costume with a tall pointed hat, a star-covered cloak, and a glowing magic wand, casting a sparkling spell over a bubbling cauldron filled with green potion, in a spooky enchanted forest with jack-o-lanterns lining a winding path, owls perched on twisted branches, a haunted castle silhouette against an orange sky",
    "wearing a classic mummy wrapping that's partially unraveled to show a fancy suit underneath, emerging from an ancient Egyptian sarcophagus in a torch-lit tomb filled with golden treasure, hieroglyphics on the walls, scarab beetles glowing, a swirl of supernatural energy spiraling upward through the pyramid chamber",
  ]},
  11: { holiday: "Thanksgiving", prompts: [
    "wearing a full Pilgrim outfit with a buckled hat, white collar, and brown vest, holding a magnificent golden roasted turkey on a silver platter in both paws, standing at the head of a lavish Thanksgiving feast table loaded with pumpkin pie, cranberry sauce, cornucopia overflowing with autumn harvest, fall leaves in brilliant orange and red, a cozy log cabin with a roaring fireplace in the background",
    "wearing a cozy hand-knit autumn sweater with fall leaf patterns and a warm scarf, sitting in an oversized rocking chair on a rustic farmhouse porch surrounded by towers of pumpkins, hay bales, corn stalks, a steaming mug of apple cider in one paw, golden sunlight filtering through crimson and amber maple trees, a harvest wagon in the yard",
    "wearing a fancy chef's outfit with a tall white hat and an apron embroidered with autumn leaves, proudly presenting an enormous cornucopia overflowing with roasted vegetables, pies, and bread, standing in a warm country kitchen with copper pots, dried herbs hanging from rafters, a wood-burning stove, and a window showing a peaceful autumn countryside",
  ]},
  12: { holiday: "Christmas", prompts: [
    "wearing a complete Santa Claus suit with wide black belt, golden buckle, fur-trimmed boots, and a red hat with fluffy white pom-pom, holding a bulging sack of wrapped presents over one shoulder and a candy cane staff in the other paw, standing next to a magnificently decorated Christmas tree with glowing lights and ornaments, a stone fireplace with hung stockings, snow falling gently outside a frosted window, warm golden lighting",
    "wearing an elegant ice-blue winter ball gown or suit with silver snowflake embroidery, a crystal tiara, and a white fur stole, standing in a magical winter wonderland with a frozen lake, ice sculptures, northern lights shimmering in the sky, snow-covered pine trees decorated with fairy lights, and a horse-drawn sleigh waiting nearby",
    "wearing a cozy Christmas elf outfit with pointy shoes, striped stockings, and a jingling bell hat, working in Santa's toy workshop surrounded by colorful wrapped presents on conveyor belts, toy trains, teddy bears, a giant candy cane archway, twinkling string lights everywhere, and a window showing reindeer on the snowy rooftop",
  ]},
};

/** Pick a random prompt variant for a month, respecting gender-specific overrides. */
function pickRandomPrompt(month: number, gender: "male" | "female"): string {
  const theme = MONTH_THEMES[month];
  const variants = (gender === "male" && theme.malePrompts) ? theme.malePrompts : theme.prompts;
  return variants[Math.floor(Math.random() * variants.length)];
}

/** Replace gender placeholders in a prompt string. */
function applyGender(prompt: string, gender: "male" | "female"): string {
  const isMale = gender === "male";
  return prompt
    .replace(/\{\{HE_SHE\}\}/g, isMale ? "he" : "she")
    .replace(/\{\{HIS_HER\}\}/g, isMale ? "his" : "her")
    .replace(/\{\{HIM_HER\}\}/g, isMale ? "him" : "her");
}

/** Build a rolling 12-month schedule starting from the current month. */
function getRolling12Months(gender: "male" | "female"): Array<{ month: number; year: number; holiday: string; prompt: string }> {
  const now = new Date();
  const startMonth = now.getMonth() + 1; // 1-indexed
  const startYear = now.getFullYear();
  const result: Array<{ month: number; year: number; holiday: string; prompt: string }> = [];

  for (let i = 0; i < 12; i++) {
    const m = ((startMonth - 1 + i) % 12) + 1; // 1-12
    const y = startYear + Math.floor((startMonth - 1 + i) / 12);
    const theme = MONTH_THEMES[m];
    const holiday = (gender === "male" && theme.maleHoliday) ? theme.maleHoliday : theme.holiday;
    const rawPrompt = pickRandomPrompt(m, gender);
    result.push({ month: m, year: y, holiday, prompt: applyGender(rawPrompt, gender) });
  }
  return result;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const IMAGE_CONCURRENCY = 6;

async function generateMonthImages(calendarId: number, petName: string, petType: string, petGender: "male" | "female", photoBuffer: Buffer) {
  console.log(`CALENDAR[${calendarId}]: Starting image generation for ${petName} (${petType}, ${petGender}), 12 months`);
  await storage.updatePetCalendarStatus(calendarId, "generating");

  const rollingMonths = getRolling12Months(petGender);
  console.log(`CALENDAR[${calendarId}]: Rolling months: ${rollingMonths.map(m => `${m.month}/${m.year}`).join(", ")}`);

  // Pre-create all month rows in parallel so DB writes don't block generation
  const monthRows = await Promise.all(
    rollingMonths.map((monthInfo) =>
      storage.createPetCalendarMonth(calendarId, monthInfo.month, monthInfo.year, monthInfo.holiday)
    )
  );

  // Create OpenAI client once for all requests
  const openai = getOpenAIClient();

  const limit = pLimit(IMAGE_CONCURRENCY);
  let completedCount = 0;

  try {
    await Promise.all(
      rollingMonths.map((monthInfo, idx) =>
        limit(async () => {
          try {
            const monthRow = monthRows[idx];

            const pronoun = petGender === "male" ? "him" : "her";
            const prompt = `Professional studio-quality portrait of a ${petGender} ${petType} named ${petName}, anthropomorphized and sitting upright, ${monthInfo.prompt}. CRITICAL: preserve the ${petType}'s exact face, fur coloring, breed features, and eye color from the reference photo — only add the costume and scene around ${pronoun}. Hyper-detailed, dramatic lighting, vivid saturated colors, shot with a high-end DSLR, suitable for a premium printed wall calendar. The ${petType} should look majestic and heroic in the scene.`;

            console.log(`CALENDAR[${calendarId}]: Generating ${monthInfo.month}/${monthInfo.year} (${monthInfo.holiday})...`);

            // Convert buffer to file per-request (OpenAI SDK consumes the stream)
            const imageFile = await toFile(photoBuffer, "pet.png", { type: "image/png" });

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
      const { petName, petType, petGender } = req.body;
      if (!petName || !petType || !req.file) {
        return res.status(400).json({ error: "Missing petName, petType, or photo" });
      }
      const gender = petGender === "female" ? "female" : "male";

      const photoBase64 = req.file.buffer.toString("base64");

      const calendar = await storage.createPetCalendar({
        petName,
        petType,
        petGender: gender,
        photoData: photoBase64,
      });

      generateMonthImages(calendar.id, petName, petType, gender, req.file.buffer).catch(console.error);

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
          generateMonthImages(id, calendar.petName, calendar.petType, calendar.petGender, photoBuffer).catch((err) => {
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
