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
client/src/
  pages/          - Home, About, Calendars, Book, PetCalendarCreate, PetCalendarView, PetCalendarSuccess
  components/     - Navbar, Footer, SoapDivider, ui/ (shadcn)
  data/           - siteData.ts (all content: services, FAQs, team, etc.)
  lib/providers/  - calendarProvider.ts (mock/live calendar integration)
  hooks/          - use-toast, use-mobile

server/
  index.ts        - Express server with Stripe init
  routes.ts       - Booking + Pet Calendar API routes
  storage.ts      - Database storage (IStorage interface)
  db.ts           - PostgreSQL connection via Drizzle
  stripeClient.ts - Stripe integration via Replit connectors
  webhookHandlers.ts - Stripe webhook processing

shared/
  schema.ts       - Drizzle schemas for users, bookings, pet_calendars, pet_calendar_months
```

## Pages
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
- **Stripe Integration**: Payment processing for pet calendar purchases ($29.99)

## API Routes
- `POST /api/bookings` - Create a grooming booking
- `GET /api/bookings/:id` - Get booking details
- `POST /api/pet-calendars` - Create a pet calendar (multipart form with photo)
- `GET /api/pet-calendars/:id` - Get calendar status and generated images
- `POST /api/pet-calendars/:id/checkout` - Create Stripe checkout session
- `GET /api/checkout/verify` - Verify Stripe payment
- `GET /api/stripe/status` - Check if Stripe is enabled
- `GET /api/stripe/publishable-key` - Get Stripe publishable key

## Database Tables
- `users` - User accounts
- `bookings` - Grooming appointments
- `pet_calendars` - Pet calendar orders (petName, petType, photoData, status)
- `pet_calendar_months` - Individual month images (calendarId, month, holidayName, imageUrl)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session secret
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (via Replit AI integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL (via Replit AI integrations)
- Stripe credentials managed via Replit Stripe connector

## Content Management
All services, prices, durations, FAQs, policies, testimonials, and team info are in `client/src/data/siteData.ts` for easy editing.

## Running
```
npm run dev
```
Starts Express backend + Vite frontend on port 5000.
