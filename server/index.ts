console.log("Starting server...");

// Catch fatal errors early so Railway logs show them
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

console.log("Modules imported successfully");

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export let stripeEnabled = false;
export let squareEnabled = false;
export let depositEnabled = false;
export let emailEnabled = false;

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

async function initStripe() {
  console.log("Initializing Stripe...");
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    log("STRIPE_SECRET_KEY not found, skipping Stripe init");
    return;
  }
  try {
    const { getUncachableStripeClient } = await import("./stripeClient");
    await getUncachableStripeClient();
    stripeEnabled = true;
    log("Stripe initialized");
  } catch (error) {
    log("Stripe not available — running without payments");
    stripeEnabled = false;
  }
  console.log("Stripe init complete");
}

function initSquare() {
  console.log("Initializing Square...");
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (accessToken && locationId) {
    squareEnabled = true;
    log("Square configured (access token + location ID found)");
  } else {
    log("Square not configured — booking availability will use fallback slots");
  }
}

function initEmail() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpUser && smtpPass) {
    emailEnabled = true;
    log(`Email configured (${smtpUser})`);
  } else {
    log("Email not configured — booking notifications will be skipped");
  }
}

async function checkDatabase() {
  console.log("Checking database connectivity...");
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");

    // Test basic connectivity
    await db.execute(sql`SELECT 1`);
    console.log("Database connection: OK");

    // Check if required tables exist
    const tables = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('bookings', 'pet_calendars', 'pet_calendar_months')
    `);
    const existingTables = tables.rows.map((r: any) => r.table_name);
    const required = ["bookings", "pet_calendars", "pet_calendar_months"];
    const missing = required.filter((t) => !existingTables.includes(t));

    if (missing.length > 0) {
      console.error(`CRITICAL: Missing database tables: ${missing.join(", ")}. Run 'drizzle-kit push' against the Railway database.`);
    } else {
      console.log(`Database tables verified: ${existingTables.join(", ")}`);
    }
  } catch (err) {
    console.error("Database connectivity check FAILED:", err instanceof Error ? err.message : err);
    console.error("Endpoints that require the database will return 500 errors.");
  }
}

console.log("Setting up middleware...");

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    if (!stripeEnabled) return res.status(503).json({ error: "Stripe not configured" });
    try {
      const { WebhookHandlers } = await import("./webhookHandlers");
      const signature = req.headers["stripe-signature"];
      if (!signature) return res.status(400).json({ error: "Missing stripe-signature" });
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error.message);
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

app.use(
  express.json({
    limit: "20mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Verify database connectivity and tables
    await checkDatabase();

    // Initialize services
    await initStripe();
    initSquare();
    depositEnabled = process.env.DEPOSIT_ENABLED === "true";
    log(`Deposit collection: ${depositEnabled ? "ENABLED" : "DISABLED (set DEPOSIT_ENABLED=true to enable)"}`);
    initEmail();

    console.log("Registering routes...");
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });

    if (process.env.NODE_ENV === "production") {
      console.log("Serving static files...");
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    console.log(`Calling app.listen on port ${port}...`);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  } catch (err) {
    console.error("Server startup failed:", err);
    process.exit(1);
  }
})();
