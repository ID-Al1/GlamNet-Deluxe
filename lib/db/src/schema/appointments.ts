import { pgTable, text, real, integer, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const appointmentStatusEnum = pgEnum("appointment_status", ["pending", "confirmed", "completed", "cancelled"]);

export const appointmentsTable = pgTable("appointments", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => usersTable.id),
  clientName: text("client_name").notNull(),
  stylistId: text("stylist_id").notNull(),
  stylistName: text("stylist_name").notNull(),
  serviceId: text("service_id").notNull(),
  serviceName: text("service_name").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: appointmentStatusEnum("status").notNull().default("pending"),
  price: real("price").notNull(),
  duration: integer("duration").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Appointment = typeof appointmentsTable.$inferSelect;
