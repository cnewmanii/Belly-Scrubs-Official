import { db } from "./db";
import {
  type User, type InsertUser,
  type Booking, type InsertBooking,
  type PetCalendar, type InsertPetCalendar,
  type PetCalendarMonth,
  bookings, petCalendars, petCalendarMonths,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getBooking(id: string): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBookingDepositStatus(id: string, status: string, stripeSessionId: string): Promise<void>;
  updateBookingSquareId(id: string, squareAppointmentId: string): Promise<void>;
  updateBookingStatus(id: string, status: string): Promise<void>;
  getBookingByStripeSession(sessionId: string): Promise<Booking | undefined>;
  updateBookingPhoto(id: string, photoUrl: string, photoTimestamp: Date | null): Promise<void>;
  updateBookingApprovalToken(id: string, token: string): Promise<void>;
  getBookingByApprovalToken(token: string): Promise<Booking | undefined>;
  approveBooking(id: string): Promise<void>;

  createPetCalendar(data: InsertPetCalendar): Promise<PetCalendar>;
  getPetCalendar(id: number): Promise<PetCalendar | undefined>;
  updatePetCalendarStatus(id: number, status: string): Promise<void>;
  updatePetCalendarPurchased(id: number, sessionId: string, email: string): Promise<void>;
  getPetCalendarBySession(sessionId: string): Promise<PetCalendar | undefined>;
  getPetCalendarMonths(calendarId: number): Promise<PetCalendarMonth[]>;
  createPetCalendarMonth(calendarId: number, month: number, holidayName: string): Promise<PetCalendarMonth>;
  updatePetCalendarMonthImage(id: number, imageUrl: string): Promise<void>;
  getGeneratedMonthCount(calendarId: number): Promise<number>;
}

class DatabaseStorage implements IStorage {
  // Users still in-memory (not critical for booking flow)
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // --- Bookings (now in PostgreSQL) ---

  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const [booking] = await db.insert(bookings).values({
      ...insertBooking,
      petBreed: insertBooking.petBreed ?? null,
      notes: insertBooking.notes ?? null,
    }).returning();
    return booking;
  }

  async updateBookingDepositStatus(id: string, status: string, stripeSessionId: string): Promise<void> {
    await db.update(bookings)
      .set({ depositStatus: status, depositStripeSessionId: stripeSessionId })
      .where(eq(bookings.id, id));
  }

  async updateBookingSquareId(id: string, squareAppointmentId: string): Promise<void> {
    await db.update(bookings)
      .set({ squareAppointmentId })
      .where(eq(bookings.id, id));
  }

  async updateBookingStatus(id: string, status: string): Promise<void> {
    await db.update(bookings)
      .set({ status })
      .where(eq(bookings.id, id));
  }

  async getBookingByStripeSession(sessionId: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings)
      .where(eq(bookings.depositStripeSessionId, sessionId));
    return booking;
  }

  async updateBookingPhoto(id: string, photoUrl: string, photoTimestamp: Date | null): Promise<void> {
    await db.update(bookings)
      .set({ petPhotoUrl: photoUrl, petPhotoTimestamp: photoTimestamp })
      .where(eq(bookings.id, id));
  }

  async updateBookingApprovalToken(id: string, token: string): Promise<void> {
    await db.update(bookings)
      .set({ approvalToken: token })
      .where(eq(bookings.id, id));
  }

  async getBookingByApprovalToken(token: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings)
      .where(eq(bookings.approvalToken, token));
    return booking;
  }

  async approveBooking(id: string): Promise<void> {
    await db.update(bookings)
      .set({ status: "confirmed", approvedAt: new Date() })
      .where(eq(bookings.id, id));
  }

  // --- Pet Calendars (unchanged) ---

  async createPetCalendar(data: InsertPetCalendar): Promise<PetCalendar> {
    const [calendar] = await db.insert(petCalendars).values(data).returning();
    return calendar;
  }

  async getPetCalendar(id: number): Promise<PetCalendar | undefined> {
    const [calendar] = await db.select().from(petCalendars).where(eq(petCalendars.id, id));
    return calendar;
  }

  async updatePetCalendarStatus(id: number, status: string): Promise<void> {
    await db.update(petCalendars).set({ status: status as any }).where(eq(petCalendars.id, id));
  }

  async updatePetCalendarPurchased(id: number, sessionId: string, email: string): Promise<void> {
    await db.update(petCalendars)
      .set({ status: "purchased", stripeSessionId: sessionId, customerEmail: email })
      .where(eq(petCalendars.id, id));
  }

  async getPetCalendarBySession(sessionId: string): Promise<PetCalendar | undefined> {
    const [calendar] = await db.select().from(petCalendars).where(eq(petCalendars.stripeSessionId, sessionId));
    return calendar;
  }

  async getPetCalendarMonths(calendarId: number): Promise<PetCalendarMonth[]> {
    return db.select().from(petCalendarMonths).where(eq(petCalendarMonths.calendarId, calendarId));
  }

  async createPetCalendarMonth(calendarId: number, month: number, holidayName: string): Promise<PetCalendarMonth> {
    const [row] = await db.insert(petCalendarMonths).values({ calendarId, month, holidayName }).returning();
    return row;
  }

  async updatePetCalendarMonthImage(id: number, imageUrl: string): Promise<void> {
    await db.update(petCalendarMonths).set({ imageUrl, generated: 1 }).where(eq(petCalendarMonths.id, id));
  }

  async getGeneratedMonthCount(calendarId: number): Promise<number> {
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM pet_calendar_months WHERE calendar_id = ${calendarId} AND generated = 1`
    );
    return parseInt((result.rows[0] as any).count, 10);
  }
}

export const storage: IStorage = new DatabaseStorage();
