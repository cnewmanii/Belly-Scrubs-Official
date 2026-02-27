import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "../storage";
import { insertBookingSchema } from "@shared/schema";
import { stripeEnabled, depositEnabled, emailEnabled } from "../index";
import { getSquareOccupiedSlots } from "../squareClient";
import { log } from "../index";
import { randomUUID } from "crypto";

const DEPOSIT_AMOUNT_CENTS = 2500; // $25.00
const PHOTO_MAX_AGE_DAYS = 7;

// Fixed booking time slots
const FIXED_SLOTS = [
  { time: "09:00", label: "9:00 AM" },
  { time: "11:00", label: "11:00 AM" },
  { time: "13:00", label: "1:00 PM" },
  { time: "15:00", label: "3:00 PM" },
];

// Business hours by day of week (0=Sun, 6=Sat)
const BUSINESS_HOURS: Record<number, { open: number; close: number } | null> = {
  0: null,           // Sunday - closed
  1: { open: 9, close: 17 },
  2: { open: 9, close: 17 },
  3: { open: 9, close: 17 },
  4: { open: 9, close: 17 },
  5: { open: 9, close: 17 },
  6: { open: 10, close: 18 },
};

// Multer config for pet photo uploads
const uploadDir = path.join(process.cwd(), "client", "public", "uploads", "bookings");
fs.mkdirSync(uploadDir, { recursive: true });

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and HEIC images are allowed"));
    }
  },
});

/**
 * Extract photo date from EXIF metadata.
 * Returns null if no EXIF date found.
 */
async function getPhotoExifDate(filePath: string): Promise<Date | null> {
  try {
    const exifr = await import("exifr");
    const data = await exifr.default.parse(filePath, {
      pick: ["DateTimeOriginal", "CreateDate", "ModifyDate", "GPSDateStamp"],
    });

    if (!data) return null;

    // Try EXIF date fields in order of reliability
    const dateValue = data.DateTimeOriginal || data.CreateDate || data.ModifyDate;
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === "string") return new Date(dateValue);

    return null;
  } catch (err) {
    log(`EXIF parse error: ${err}`, "booking");
    return null;
  }
}

/**
 * Check if a photo's EXIF date is within the allowed age.
 */
function isPhotoRecent(exifDate: Date | null): { valid: boolean; reason?: string } {
  if (!exifDate) {
    return {
      valid: false,
      reason: "Could not read photo date. Please upload a photo taken directly from your phone camera (not a screenshot or saved image).",
    };
  }

  const now = new Date();
  const maxAge = PHOTO_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const age = now.getTime() - exifDate.getTime();

  if (age > maxAge) {
    return {
      valid: false,
      reason: `This photo was taken more than ${PHOTO_MAX_AGE_DAYS} days ago. Please upload a recent photo of your pet's current coat condition.`,
    };
  }

  if (age < 0) {
    return {
      valid: false,
      reason: "This photo has a future date. Please upload a genuine, recent photo.",
    };
  }

  return { valid: true };
}

export function registerBookingRoutes(app: Express) {

  // ─── Availability ───────────────────────────────────────────

  app.get("/api/availability", async (req: Request, res: Response) => {
    try {
      const { date } = req.query;
      if (!date || typeof date !== "string") {
        return res.status(400).json({ error: "Missing date parameter (YYYY-MM-DD)" });
      }

      const [year, month, day] = date.split("-").map(Number);
      const requestedDate = new Date(year, month - 1, day);
      const dayOfWeek = requestedDate.getDay();
      const hours = BUSINESS_HOURS[dayOfWeek];

      if (!hours) return res.json({ date, slots: [] });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (requestedDate < today) return res.json({ date, slots: [] });

      let occupiedTimes: string[] = [];
      try {
        occupiedTimes = await getSquareOccupiedSlots(date);
      } catch (err: any) {
        log(`Square availability check failed: ${err.message}`, "booking");
      }

      const slots = FIXED_SLOTS
        .filter((slot) => {
          const slotHour = parseInt(slot.time.split(":")[0], 10);
          return slotHour >= hours.open && (slotHour + 2) <= hours.close;
        })
        .map((slot) => ({
          id: `${date}-${slot.time.replace(":", "")}`,
          startTime: slot.time,
          endTime: `${(parseInt(slot.time.split(":")[0], 10) + 2).toString().padStart(2, "0")}:00`,
          available: !occupiedTimes.includes(slot.time),
        }));

      return res.json({ date, slots });
    } catch (err) {
      log(`Availability error: ${err}`, "booking");
      return res.status(500).json({ error: "Failed to check availability" });
    }
  });

  // ─── Deposit status (for frontend to know if deposit is on/off) ──

  app.get("/api/bookings/config", async (_req: Request, res: Response) => {
    res.json({
      depositEnabled,
      depositAmount: DEPOSIT_AMOUNT_CENTS,
    });
  });

  // ─── Validate photo EXIF before full submission ─────────────

  app.post("/api/bookings/validate-photo", photoUpload.single("photo"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ valid: false, reason: "No photo uploaded" });
      }

      const exifDate = await getPhotoExifDate(req.file.path);
      const check = isPhotoRecent(exifDate);

      if (!check.valid) {
        // Clean up rejected file
        fs.unlinkSync(req.file.path);
        return res.json({ valid: false, reason: check.reason });
      }

      // Photo is valid — return temp filename so it can be referenced on final submit
      return res.json({
        valid: true,
        tempFile: req.file.filename,
        photoDate: exifDate?.toISOString(),
      });
    } catch (err: any) {
      log(`Photo validation error: ${err.message}`, "booking");
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(500).json({ valid: false, reason: "Failed to validate photo" });
    }
  });

  // ─── Create booking ─────────────────────────────────────────

  // Use multer.none() to parse multipart/form-data without file fields
  const formDataParser = multer().none();

  app.post("/api/bookings", formDataParser, async (req: Request, res: Response) => {
    try {
      // Parse form fields — addOns comes as JSON string from FormData
      const body = { ...req.body };
      if (typeof body.addOns === "string") {
        try { body.addOns = JSON.parse(body.addOns); } catch { body.addOns = []; }
      }
      if (typeof body.totalPrice === "string") {
        body.totalPrice = parseInt(body.totalPrice, 10);
      }
      // Normalize null strings from FormData
      if (body.petBreed === "null" || body.petBreed === "") body.petBreed = null;
      if (body.notes === "null" || body.notes === "") body.notes = null;

      const parsed = insertBookingSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid booking data", details: parsed.error.issues });
      }

      const { tempPhotoFile, photoDate } = body;

      // Require photo
      if (!tempPhotoFile) {
        return res.status(400).json({ error: "Pre-groom photo is required" });
      }

      // Verify the temp photo file exists
      const photoFilePath = path.join(uploadDir, tempPhotoFile);
      if (!fs.existsSync(photoFilePath)) {
        return res.status(400).json({ error: "Photo file not found. Please re-upload your photo." });
      }

      // Create the booking
      const booking = await storage.createBooking(parsed.data);

      // Update photo info
      const photoUrl = `/uploads/bookings/${tempPhotoFile}`;
      const photoTimestamp = photoDate ? new Date(photoDate) : null;
      await storage.updateBookingPhoto(booking.id, photoUrl, photoTimestamp);

      // Generate approval token for staff
      const approvalToken = randomUUID();
      await storage.updateBookingApprovalToken(booking.id, approvalToken);

      // If deposit is ENABLED and Stripe is ready, create checkout session
      if (depositEnabled && stripeEnabled) {
        try {
          const { getUncachableStripeClient } = await import("../stripeClient");
          const stripe = await getUncachableStripeClient();
          const baseUrl = `https://${req.get("host")}`;

          const session = await stripe.checkout.sessions.create({
            line_items: [
              {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: `Booking Deposit - ${parsed.data.serviceName}`,
                    description: `$25 non-refundable deposit for ${parsed.data.petName}'s grooming on ${parsed.data.date}`,
                  },
                  unit_amount: DEPOSIT_AMOUNT_CENTS,
                },
                quantity: 1,
              },
            ],
            mode: "payment",
            customer_email: parsed.data.customerEmail,
            success_url: `${baseUrl}/book/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
            cancel_url: `${baseUrl}/book?cancelled=true`,
            metadata: { bookingId: booking.id, type: "booking_deposit" },
            payment_intent_data: {
              metadata: { bookingId: booking.id, type: "booking_deposit" },
            },
          });

          await storage.updateBookingDepositStatus(booking.id, "pending", session.id!);

          // Send emails after checkout redirect (they'll fire in background)
          sendBookingEmails(booking.id, photoFilePath, approvalToken).catch(console.error);

          return res.status(201).json({
            id: booking.id,
            checkoutUrl: session.url,
            depositEnabled: true,
          });
        } catch (stripeErr: any) {
          log(`Stripe checkout failed: ${stripeErr.message}`, "booking");
        }
      }

      // Deposit DISABLED or Stripe failed — proceed without deposit
      await storage.updateBookingStatus(booking.id, "pending_review");

      // Send emails
      sendBookingEmails(booking.id, photoFilePath, approvalToken).catch(console.error);

      return res.status(201).json({
        id: booking.id,
        checkoutUrl: null,
        depositEnabled: false,
      });
    } catch (err) {
      log(`Booking creation error: ${err}`, "booking");
      return res.status(500).json({ error: "Failed to create booking" });
    }
  });

  // ─── Verify Stripe deposit ──────────────────────────────────

  app.get("/api/bookings/:id/verify", async (req: Request, res: Response) => {
    try {
      const bookingId = req.params.id;
      const sessionId = req.query.session_id as string;

      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      // If no session_id, this is a no-deposit booking — just return it
      if (!sessionId) {
        return res.json({ success: true, booking });
      }

      // Already verified
      if (booking.depositStatus === "paid") {
        return res.json({ success: true, booking });
      }

      if (!stripeEnabled) {
        return res.status(503).json({ error: "Payment system not configured" });
      }

      const { getUncachableStripeClient } = await import("../stripeClient");
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        await storage.updateBookingDepositStatus(bookingId, "paid", sessionId);
        await storage.updateBookingStatus(bookingId, "pending_review");

        const updatedBooking = await storage.getBooking(bookingId);
        return res.json({ success: true, booking: updatedBooking });
      }

      return res.json({ success: false, reason: "Payment not completed" });
    } catch (err: any) {
      log(`Booking verify error: ${err.message}`, "booking");
      return res.status(500).json({ error: "Failed to verify booking" });
    }
  });

  // ─── Staff approval (clicked from email link) ──────────────

  app.get("/api/bookings/:id/approve", async (req: Request, res: Response) => {
    try {
      const bookingId = req.params.id;
      const token = req.query.token as string;

      if (!token) {
        return res.status(400).send(approvalPage("Missing approval token.", false));
      }

      const booking = await storage.getBookingByApprovalToken(token);
      if (!booking || booking.id !== bookingId) {
        return res.status(404).send(approvalPage("Invalid or expired approval link.", false));
      }

      if (booking.status === "confirmed") {
        return res.send(approvalPage(`This appointment for ${booking.petName} is already confirmed.`, true));
      }

      // Approve the booking
      await storage.approveBooking(bookingId);

      // Create Square appointment (non-blocking)
      try {
        const { createSquareAppointment } = await import("../squareClient");
        const squareId = await createSquareAppointment({
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          petName: booking.petName,
          petBreed: booking.petBreed,
          serviceName: booking.serviceName,
          addOns: booking.addOns || [],
          date: booking.date,
          time: booking.time,
          totalPrice: booking.totalPrice,
          depositAmount: booking.depositStatus === "paid" ? DEPOSIT_AMOUNT_CENTS / 100 : 0,
          notes: booking.notes,
        });
        await storage.updateBookingSquareId(bookingId, squareId);
        log(`Square appointment created for approved booking ${bookingId}: ${squareId}`, "booking");
      } catch (squareErr: any) {
        log(`Square creation failed on approval: ${squareErr.message}`, "booking");
      }

      // Send confirmation email to customer
      if (emailEnabled) {
        try {
          const { sendBookingApprovedEmail } = await import("../emailService");
          const updatedBooking = await storage.getBooking(bookingId);
          if (updatedBooking) await sendBookingApprovedEmail(updatedBooking);
        } catch (emailErr: any) {
          log(`Approval email failed: ${emailErr.message}`, "email");
        }
      }

      return res.send(approvalPage(
        `Appointment for ${booking.petName} (${booking.customerName}) has been approved and added to Square!`,
        true
      ));
    } catch (err: any) {
      log(`Approval error: ${err.message}`, "booking");
      return res.status(500).send(approvalPage("Something went wrong. Please try again.", false));
    }
  });

  // ─── Get booking details ────────────────────────────────────

  app.get("/api/bookings/:id", async (req: Request, res: Response) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      return res.json(booking);
    } catch (err) {
      return res.status(500).json({ error: "Failed to get booking" });
    }
  });
}

// ─── Helper: send both booking emails ───────────────────────

async function sendBookingEmails(bookingId: string, photoFilePath: string, approvalToken: string) {
  if (!emailEnabled) {
    log("Email not configured, skipping booking notifications", "email");
    return;
  }

  try {
    const booking = await storage.getBooking(bookingId);
    if (!booking) return;

    const { sendCustomerBookingEmail, sendStaffBookingEmail } = await import("../emailService");

    // Send both emails concurrently
    await Promise.all([
      sendCustomerBookingEmail(booking),
      sendStaffBookingEmail(booking, photoFilePath, approvalToken),
    ]);
  } catch (err: any) {
    log(`Booking email error: ${err.message}`, "email");
  }
}

// ─── Helper: approval HTML page ─────────────────────────────

function approvalPage(message: string, success: boolean): string {
  const color = success ? "#16a34a" : "#dc2626";
  const icon = success ? "✓" : "✗";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking ${success ? "Approved" : "Error"} - Belly scRubs</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f0f7fa; }
    .card { background: white; border-radius: 16px; padding: 40px; max-width: 500px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
    .icon { width: 64px; height: 64px; border-radius: 50%; background: ${color}20; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; color: ${color}; margin-bottom: 16px; }
    h1 { color: #1a2a33; font-size: 22px; }
    p { color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>Belly scRubs</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
