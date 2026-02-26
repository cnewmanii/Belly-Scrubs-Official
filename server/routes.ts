import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { toFile } from "openai";
import { storage } from "./storage";
import { insertBookingSchema } from "@shared/schema";
import { stripeEnabled } from "./index";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const config: { apiKey?: string; baseURL?: string } = { apiKey };
  if (!process.env.OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    config.baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  }
  return new OpenAI(config);
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

async function generateMonthImages(calendarId: number, petName: string, petType: string, photoBuffer: Buffer) {
  await storage.updatePetCalendarStatus(calendarId, "generating");

  const genDir = path.join(process.cwd(), "client", "public", "generated", String(calendarId));
  fs.mkdirSync(genDir, { recursive: true });

  for (const monthInfo of MONTHS) {
    try {
      const monthRow = await storage.createPetCalendarMonth(calendarId, monthInfo.month, monthInfo.holiday);

      const prompt = `A charming, high-quality digital illustration of a ${petType} named ${petName} ${monthInfo.prompt}. The ${petType} is the main subject, depicted in a warm and playful illustration style suitable for a wall calendar. Keep the pet's appearance consistent and adorable.`;

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
      }
    } catch (err) {
      console.error(`Error generating month ${monthInfo.month}:`, err);
    }
  }

  await storage.updatePetCalendarStatus(calendarId, "ready");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/bookings", async (req, res) => {
    try {
      const parsed = insertBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid booking data", details: parsed.error.issues });
      }
      const booking = await storage.createBooking(parsed.data);
      return res.status(201).json(booking);
    } catch (err) {
      return res.status(500).json({ error: "Failed to create booking" });
    }
  });

  app.get("/api/bookings/:id", async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      return res.json(booking);
    } catch (err) {
      return res.status(500).json({ error: "Failed to get booking" });
    }
  });

  app.get("/api/stripe/status", async (req: Request, res: Response) => {
    res.json({ enabled: stripeEnabled });
  });

  app.get("/api/stripe/publishable-key", async (req: Request, res: Response) => {
    if (!stripeEnabled) return res.status(503).json({ error: "Stripe not configured" });
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const key = await getStripePublishableKey();
      res.json({ key });
    } catch (err) {
      res.status(500).json({ error: "Failed to get publishable key" });
    }
  });

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
      console.error("Calendar creation error:", err);
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

      res.json({
        id: calendar.id,
        petName: calendar.petName,
        petType: calendar.petType,
        status: calendar.status,
        generatedCount,
        totalMonths: 12,
        months: months.sort((a, b) => a.month - b.month),
      });
    } catch (err) {
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

      const { getUncachableStripeClient } = await import("./stripeClient");
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

      const { getUncachableStripeClient } = await import("./stripeClient");
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

  return httpServer;
}
