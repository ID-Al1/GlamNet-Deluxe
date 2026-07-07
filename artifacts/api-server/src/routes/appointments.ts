import { Router } from "express";
import { db, appointmentsTable, stylistProfilesTable, servicesTable, usersTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";
import { CreateAppointmentBody, UpdateAppointmentBody } from "@workspace/api-zod";
import { sendNotification } from "../lib/notifications";

const router = Router();

function formatAppt(a: typeof appointmentsTable.$inferSelect) {
  return {
    id: a.id,
    clientId: a.clientId,
    clientName: a.clientName,
    stylistId: a.stylistId,
    stylistName: a.stylistName,
    serviceId: a.serviceId,
    serviceName: a.serviceName,
    date: a.date,
    time: a.time,
    status: a.status,
    price: a.price,
    duration: a.duration,
    notes: a.notes ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/appointments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { status, role } = req.query as Record<string, string>;

  let appts;
  if (role === "stylist" || user.role === "stylist") {
    appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.stylistId, user.id));
  } else {
    appts = await db.select().from(appointmentsTable).where(eq(appointmentsTable.clientId, user.id));
  }

  if (status) {
    appts = appts.filter(a => a.status === status);
  }

  res.json(appts.map(formatAppt));
});

router.post("/appointments", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }

  const { stylistId, serviceId, date, time, notes } = parsed.data;

  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, stylistId));
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId));

  if (!profile || !service) { res.status(404).json({ error: "Stylist or service not found" }); return; }

  const [appt] = await db.insert(appointmentsTable).values({
    id: randomUUID(),
    clientId: user.id,
    clientName: user.name,
    stylistId,
    stylistName: profile.name,
    serviceId,
    serviceName: service.name,
    date,
    time,
    status: "pending",
    price: service.price,
    duration: service.duration,
    notes: notes ?? null,
  }).returning();

  // Notify stylist of new booking (non-fatal)
  try {
    const [stylistUser] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
    await sendNotification(stylistUser?.phone, "booking.created", {
      clientName: user.name,
      serviceName: service.name,
      date,
      time,
    });
  } catch { /* non-fatal */ }

  res.status(201).json(formatAppt(appt));
});

router.get("/appointments/:appointmentId", requireAuth, async (req, res) => {
  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, req.params.appointmentId));
  if (!appt) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatAppt(appt));
});

router.patch("/appointments/:appointmentId", requireAuth, async (req, res) => {
  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }
  const data = parsed.data;

  // Fetch the appointment before updating so we have context for notifications
  const [before] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, req.params.appointmentId));
  if (!before) { res.status(404).json({ error: "Not found" }); return; }

  const [appt] = await db.update(appointmentsTable).set({
    ...(data.status && { status: data.status as any }),
    ...(data.date && { date: data.date }),
    ...(data.time && { time: data.time }),
    ...(data.notes !== undefined && { notes: data.notes }),
  }).where(eq(appointmentsTable.id, req.params.appointmentId)).returning();
  if (!appt) { res.status(404).json({ error: "Not found" }); return; }

  res.json(formatAppt(appt));

  // Fire notifications asynchronously after responding — non-fatal
  if (data.status && data.status !== before.status) {
    setImmediate(async () => {
      try {
        const [clientUser] = await db.select().from(usersTable).where(eq(usersTable.id, appt.clientId));
        const sharedData = {
          stylistName: appt.stylistName,
          clientName: appt.clientName,
          serviceName: appt.serviceName,
          date: appt.date,
          time: appt.time,
        };

        if (data.status === "confirmed") {
          // Notify client
          await sendNotification(clientUser?.phone, "booking.confirmed", sharedData);
          // Notify stylist too — both sides should know a booking is locked in
          const [confirmedProfile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, appt.stylistId));
          if (confirmedProfile) {
            const [confirmedStylistUser] = await db.select().from(usersTable).where(eq(usersTable.id, confirmedProfile.userId));
            await sendNotification(confirmedStylistUser?.phone, "booking.confirmed.stylist", sharedData);
          }
        } else if (data.status === "declined" || data.status === "cancelled") {
          await sendNotification(clientUser?.phone, "booking.declined", sharedData);
        } else if (data.status === "completed") {
          // Notify client
          await sendNotification(clientUser?.phone, "booking.completed", sharedData);
          // Notify stylist too
          const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, appt.stylistId));
          if (profile) {
            const [stylistUser] = await db.select().from(usersTable).where(eq(usersTable.id, profile.userId));
            await sendNotification(stylistUser?.phone, "booking.completed", sharedData);
          }
        }
      } catch { /* non-fatal */ }
    });
  }
});

export default router;
