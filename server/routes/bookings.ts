import type { Express } from "express";
import { storage } from "../storage";
import { insertBookingSchema } from "@shared/schema";

export function registerBookingRoutes(app: Express) {
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
}
