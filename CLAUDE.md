# CLAUDE.md — Belly Scrubs Project Rules

## Project Overview
- Pet grooming website for Belly scRubs (bellyscrubs.com), Hurricane WV
- Full-stack TypeScript: React frontend + Express backend + PostgreSQL (Drizzle ORM)
- Deployed on Railway from the `main` branch via Docker
- GitHub repo: cnewmanii/Belly-Scrubs-Official

## Deployment
- Railway deploys from `main` only — all feature branches must be merged to main
- Docker build uses `format: "cjs"` (CommonJS) — NEVER use ESM format for the server build. ESM causes silent crashes from CJS package interop (square, pg, express, etc.)
- Build output is `dist/index.cjs` — Dockerfile CMD, package.json start script, and script/build.ts must all agree on this filename
- Pre-deploy step runs `npx drizzle-kit push` — schema changes are applied automatically
- Environment variables are in Railway, not .env files
- Container filesystem is ephemeral — never save user data to disk. Use the database (base64) or external storage.

## Build Rules
- The `square` npm package is CommonJS. In CJS build output, use normal `import { Client } from "square"`. Do NOT use `import pkg from "square"; const { Client } = pkg;` — that's only needed for ESM.
- When adding new database columns, they will be created by the pre-deploy drizzle-kit push. No manual migration needed.
- When adding new files (images, assets), they must be committed to git AND pushed to `main` for Railway to see them.

## Branch Management
- ALWAYS push to `main` or merge to `main` promptly. Railway only deploys `main`.
- When working on feature branches, merge to main as soon as work is verified. Do not leave work stranded on feature branches.
- I (the developer) may not have git CLI access — provide clear instructions for GitHub web UI as an alternative.

## Image/Asset Rules
- Photo filenames are case-sensitive. `.JPEG` ≠ `.jpeg` ≠ `.JPG`. Always verify exact filenames in attached_assets/ before writing imports.
- Before/after photos use descriptive names: `Before_Poodle.jpeg`, `After_Poodle.jpeg`, `Before_Moodle.JPEG`, etc.
- Team profile photos use: `Ginger_Profile.JPG` (name + "_Profile" + extension)
- Extensions must match exactly as uploaded — do NOT normalize case (e.g., keep `.JPEG` if that's the actual filename)
- Before/after photos and team photos live in `attached_assets/`
- Hero rotation photos are stored as base64 in the database (hero_photos table), uploaded via /admin
- Current before/after photo pairs:
  - Poodle: `Before_Poodle.jpeg` / `After_Poodle.jpeg`
  - Moodle: `Before_Moodle.JPEG` / `After_Moodle.JPEG`
  - Golden Retriever: `Before_Retriever.jpeg` / `After_Retriever.JPEG`
  - Yorkie: `Before_Yorki.jpeg` / `After_Yorki.jpeg`

## Square Integration
- Square Bookings API requires: serviceVariationId, serviceVariationVersion, and a real teamMemberId (not "anyone")
- Service catalog is fetched on startup and cached — lookupCatalogService() maps website service names to Square catalog entries
- Team member assignment uses pickAvailableTeamMember() which checks groomer schedules and existing bookings
- Square appointment is created on staff APPROVAL (not on booking submission)
- If Bookings API fails, falls back to customer note on the Square customer profile

## Stripe Integration
- Stripe credentials come from STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY env vars (not Replit connectors)
- Deposit is toggled via DEPOSIT_ENABLED env var
- When deposit is paid, a Square invoice is created with the deposit as a credit

## Email
- Uses Resend API (not SMTP/nodemailer)
- Approval buttons in emails must use <a> tags with inline styles (not <button> elements) for iOS Outlook compatibility
- Always include a plain-text fallback link below styled buttons
- APP_URL env var controls the base URL in email links

## OpenAI / Pet Calendar
- Uses gpt-image-1 for pet photo generation
- Images stored as base64 data URLs in the database (not filesystem)
- 12 rolling months from creation date, not fixed Jan-Dec
- First 3 months are free preview, remaining 9 locked behind purchase
- Each month has 3 prompt variants randomly selected
- Pet gender affects prompt wording (male/female costume variants)

## Server Startup
- server/index.ts has process-level error handlers (uncaughtException, unhandledRejection)
- All initialization (Stripe, Square, DB) is wrapped in try/catch — failures log but don't crash
- Database pool has connectionTimeoutMillis: 10000 to prevent silent hangs
- Console.log diagnostics at every startup stage for Railway deploy log visibility

## Booking Flow
- 6-step wizard: Service → Add-ons → Date/Time → Info → Pet Photo → Confirm
- 24-hour advance booking requirement (server + client enforced)
- Photo upload with 7-day EXIF validation
- Availability checks Square bookings to prevent double-booking
- Staff approval flow: booking created → emails sent → staff clicks approve link → Square appointment created

## Do NOT Modify
- vite.config.ts
- drizzle.config.ts

## Notes Directory
- Keep task-specific notes in /docs/notes/ — create a markdown file for each major feature or debug session
