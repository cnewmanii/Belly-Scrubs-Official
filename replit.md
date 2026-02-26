# Belly Scrubs - Dog Grooming & Self-Service Pet Wash

## Overview
A production-ready website for "Belly Scrubs", a dog grooming and self-service pet wash business. Built with React + TypeScript + Tailwind CSS, featuring a modern, playful-yet-premium design with subtle animations.

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion, wouter (routing)
- **Backend**: Express.js (Node.js)
- **Forms**: React Hook Form + Zod validation
- **State**: TanStack React Query
- **UI Components**: Shadcn/ui
- **Animations**: Framer Motion

## Brand Colors
- Coconut Twist: #F7F1E1 (background)
- Breeze Blue: #BAD9E5 (accents/sections)
- Dark Secret: #45484A (text/contrast)

## Project Structure
```
client/src/
  pages/          - Home, About, Calendars, Book (4 pages)
  components/     - Navbar, Footer, SoapDivider, ui/ (shadcn)
  data/           - siteData.ts (all content: services, FAQs, team, etc.)
  lib/providers/  - calendarProvider.ts (mock/live calendar integration)
  hooks/          - use-toast, use-mobile

server/
  routes.ts       - POST /api/bookings, GET /api/bookings/:id
  storage.ts      - In-memory storage (IStorage interface)

shared/
  schema.ts       - Drizzle schemas for users and bookings
```

## Pages
1. **Home** (`/`) - Hero, availability teaser, services, testimonials, gallery, location, FAQ, CTA
2. **About** (`/about`) - Story, values, team, facility, policies & FAQ
3. **Calendars** (`/calendars`) - Interactive calendar with mock/live toggle, time slot browser
4. **Book** (`/book`) - 5-step booking flow: Service > Add-ons > Date/Time > Info > Confirm

## Key Features
- **SoapDivider**: Signature wavy SVG divider with bubble elements
- **Floating Navbar**: Frosted glass effect with quick actions
- **Calendar Provider Pattern**: Interface supporting mock and live data sources
- **ICS Generation**: Client-side calendar file download after booking
- **Booking API**: POST /api/bookings with Zod validation

## Content Management
All services, prices, durations, FAQs, policies, testimonials, and team info are in `client/src/data/siteData.ts` for easy editing.

## Environment Variables
- `SESSION_SECRET` - Session secret (configured)
- Future: `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID` for Square Bookings/Payments integration

## Running
```
npm run dev
```
Starts Express backend + Vite frontend on port 5000.
