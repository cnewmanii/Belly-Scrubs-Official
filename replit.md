# Belly Scrubs - Dog Grooming & Self-Service Pet Wash

## Overview
A production-ready website for "Belly Scrubs", a dog grooming and self-service pet wash business. Built with React + TypeScript + Tailwind CSS, featuring a modern, playful-yet-premium design with subtle animations. Includes an integrated AI-powered Pet Calendar Creator.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion, wouter (routing)
- **Backend**: Express.js (Node.js)
- **Database**: PostgreSQL (Drizzle ORM)
- **Forms**: React Hook Form + Zod validation
- **State**: TanStack React Query
- **UI Components**: Shadcn/ui
- **Animations**: Framer Motion
- **AI**: OpenAI (gpt-image-1 for pet calendar image generation)
- **Payments**: Stripe (for pet calendar purchases)

## Brand Colors
- Coconut Twist: #F7F1E1 (background)
- Breeze Blue: #BAD9E5 (accents/sections)
- Dark Secret: #45484A (text/contrast)

## Project Structure
```
belly-scrubs/
├── client/                          # Frontend (React + Vite)
│   ├── index.html                   # HTML entry point
│   ├── public/                      # Static assets
│   │   └── favicon.png
│   └── src/
│       ├── App.tsx                  # Root component with routing
│       ├── main.tsx                 # React entry point
│       ├── index.css                # Global styles & theme variables
│       ├── components/
│       │   ├── layout/              # Site-wide layout components
│       │   │   ├── Navbar.tsx       # Floating frosted-glass navigation bar
│       │   │   ├── Footer.tsx       # Site footer with links & social
│       │   │   └── SoapDivider.tsx  # Signature wavy SVG section divider
│       │   └── ui/                  # Shadcn/ui primitives (button, card, etc.)
│       ├── pages/                   # Route-level page components
│       │   ├── Home.tsx             # Landing page with hero, services, gallery
│       │   ├── About.tsx            # Story, team, facility, policies
│       │   ├── Calendars.tsx        # Availability calendar + pet calendar promo
│       │   ├── Book.tsx             # 5-step booking wizard
│       │   ├── not-found.tsx        # 404 page
│       │   └── pet-calendar/        # AI Pet Calendar Creator feature
│       │       ├── index.ts         # Barrel exports
│       │       ├── Create.tsx       # Upload photo & create calendar
│       │       ├── View.tsx         # View generated images & purchase
│       │       └── Success.tsx      # Post-purchase confirmation
│       ├── data/
│       │   └── siteData.ts          # All content: services, FAQs, team, etc.
│       ├── hooks/
│       │   ├── use-toast.ts         # Toast notification hook
│       │   └── use-mobile.tsx       # Mobile breakpoint detection
│       └── lib/
│           ├── utils.ts             # Tailwind merge utility
│           ├── queryClient.ts       # TanStack Query configuration
│           └── providers/
│               └── calendarProvider.ts  # Mock/live calendar data provider
│
├── server/                          # Backend (Express.js)
│   ├── index.ts                     # Server entry point, Stripe init, middleware
│   ├── routes.ts                    # Route orchestrator (imports sub-routers)
│   ├── routes/                      # Modular API route handlers
│   │   ├── bookings.ts              # POST/GET /api/bookings
│   │   ├── petCalendars.ts          # Pet calendar CRUD + AI image generation
│   │   └── stripe.ts               # Stripe status & publishable key
│   ├── storage.ts                   # Data access layer (IStorage interface)
│   ├── db.ts                        # PostgreSQL connection via Drizzle
│   ├── stripeClient.ts              # Stripe client via Replit connectors
│   ├── webhookHandlers.ts           # Stripe webhook processing
│   ├── vite.ts                      # Vite dev server middleware (DO NOT MODIFY)
│   └── static.ts                    # Production static file serving
│
├── shared/                          # Shared between frontend & backend
│   └── schema.ts                    # Drizzle ORM schemas & Zod validation
│
├── drizzle.config.ts                # Drizzle ORM configuration (DO NOT MODIFY)
├── vite.config.ts                   # Vite build configuration (DO NOT MODIFY)
├── tailwind.config.ts               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
├── postcss.config.js                # PostCSS configuration
├── components.json                  # Shadcn/ui component configuration
├── package.json                     # Dependencies & scripts
└── script/
    └── build.ts                     # Production build script
```

## Pages & Routes
1. **Home** (`/`) - Hero, availability teaser, services, testimonials, gallery, location, FAQ, CTA
2. **About** (`/about`) - Story, values, team, facility, policies & FAQ
3. **Calendars** (`/calendars`) - Interactive calendar with mock/live toggle, time slot browser, pet calendar CTA
4. **Book** (`/book`) - 5-step booking flow: Service > Add-ons > Date/Time > Info > Confirm
5. **Pet Calendar Create** (`/pet-calendar/create`) - Upload pet photo, select type, create AI calendar
6. **Pet Calendar View** (`/pet-calendar/:id`) - View generated images, purchase via Stripe
7. **Pet Calendar Success** (`/pet-calendar/success`) - Checkout success confirmation

## Key Features
- **SoapDivider**: Signature wavy SVG divider with bubble elements
- **Floating Navbar**: Frosted glass effect with quick actions
- **Calendar Provider Pattern**: Interface supporting mock and live data sources
- **ICS Generation**: Client-side calendar file download after booking
- **Booking API**: POST /api/bookings with Zod validation
- **Pet Calendar Creator**: AI-generated holiday-themed pet images using OpenAI gpt-image-1
- **Stripe Integration**: Payment processing for pet calendar purchases ($29.99) — NOT YET ACTIVATED. To enable, connect Stripe via the Replit Stripe connector integration. The app runs without it; calendar creation and AI generation work, but purchasing is disabled.

## API Routes
| Method | Endpoint | Handler File | Description |
|--------|----------|-------------|-------------|
| POST | `/api/bookings` | `server/routes/bookings.ts` | Create a grooming booking |
| GET | `/api/bookings/:id` | `server/routes/bookings.ts` | Get booking details |
| POST | `/api/pet-calendars` | `server/routes/petCalendars.ts` | Create a pet calendar (multipart form) |
| GET | `/api/pet-calendars/:id` | `server/routes/petCalendars.ts` | Get calendar status & images |
| POST | `/api/pet-calendars/:id/checkout` | `server/routes/petCalendars.ts` | Create Stripe checkout session |
| GET | `/api/checkout/verify` | `server/routes/petCalendars.ts` | Verify Stripe payment |
| GET | `/api/stripe/status` | `server/routes/stripe.ts` | Check if Stripe is enabled |
| GET | `/api/stripe/publishable-key` | `server/routes/stripe.ts` | Get Stripe publishable key |

## Database Tables
- `users` - User accounts (varchar id, username, password)
- `bookings` - Grooming appointments (varchar id, service details, customer info, pet info)
- `pet_calendars` - Pet calendar orders (serial id, petName, petType, photoData, status enum)
- `pet_calendar_months` - Individual month images (serial id, calendarId FK, month, holidayName, imageUrl)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session secret
- `OPENAI_API_KEY` - OpenAI API key (primary, user-provided)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (fallback, via Replit AI integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL (used only with fallback key)
- Stripe credentials managed via Replit Stripe connector

## Content Management
All services, prices, durations, FAQs, policies, testimonials, and team info are in `client/src/data/siteData.ts` for easy editing.

## Running
```
npm run dev
```
Starts Express backend + Vite frontend on port 5000.
