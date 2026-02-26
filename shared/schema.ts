import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: text("service_id").notNull(),
  serviceName: text("service_name").notNull(),
  addOns: text("add_ons").array(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email").notNull(),
  petName: text("pet_name").notNull(),
  petBreed: text("pet_breed"),
  notes: text("notes"),
  totalPrice: integer("total_price").notNull(),
  status: text("status").default("confirmed"),
});

export const petTypeEnum = pgEnum("pet_type", ["dog", "cat"]);
export const calendarStatusEnum = pgEnum("calendar_status", [
  "pending",
  "generating",
  "ready",
  "purchased",
]);

export const petCalendars = pgTable("pet_calendars", {
  id: serial("id").primaryKey(),
  petName: text("pet_name").notNull(),
  petType: petTypeEnum("pet_type").notNull(),
  photoData: text("photo_data").notNull(),
  status: calendarStatusEnum("status").default("pending").notNull(),
  customerEmail: text("customer_email"),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const petCalendarMonths = pgTable("pet_calendar_months", {
  id: serial("id").primaryKey(),
  calendarId: integer("calendar_id").notNull().references(() => petCalendars.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  holidayName: text("holiday_name").notNull(),
  imageUrl: text("image_url"),
  generated: integer("generated").default(0).notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  status: true,
});

export const insertPetCalendarSchema = createInsertSchema(petCalendars).omit({
  id: true,
  status: true,
  customerEmail: true,
  stripeSessionId: true,
  createdAt: true,
});

export const insertPetCalendarMonthSchema = createInsertSchema(petCalendarMonths).omit({
  id: true,
  generated: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertPetCalendar = z.infer<typeof insertPetCalendarSchema>;
export type PetCalendar = typeof petCalendars.$inferSelect;
export type InsertPetCalendarMonth = z.infer<typeof insertPetCalendarMonthSchema>;
export type PetCalendarMonth = typeof petCalendarMonths.$inferSelect;
