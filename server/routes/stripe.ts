import type { Express, Request, Response } from "express";
import { stripeEnabled } from "../index";

export function registerStripeRoutes(app: Express) {
  app.get("/api/stripe/status", async (req: Request, res: Response) => {
    res.json({ enabled: stripeEnabled });
  });

  app.get("/api/stripe/publishable-key", async (req: Request, res: Response) => {
    if (!stripeEnabled) return res.status(503).json({ error: "Stripe not configured" });
    try {
      const { getStripePublishableKey } = await import("../stripeClient");
      const key = await getStripePublishableKey();
      res.json({ key });
    } catch (err) {
      res.status(500).json({ error: "Failed to get publishable key" });
    }
  });
}
