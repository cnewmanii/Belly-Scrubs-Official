import type { Express } from "express";
import { type Server } from "http";
import { registerBookingRoutes } from "./routes/bookings";
import { registerPetCalendarRoutes } from "./routes/petCalendars";
import { registerStripeRoutes } from "./routes/stripe";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerBookingRoutes(app);
  registerStripeRoutes(app);
  registerPetCalendarRoutes(app);

  return httpServer;
}
