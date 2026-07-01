import { Router } from "express";
import {
  db, appointmentsTable, bookingTeamMembersTable, stylistProfilesTable, usersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";

const router = Router();

// Stylist sees all pending team invitations for them
router.get("/team-invitations", requireAuth, async (req, res) => {
  const user = (req as any).user;

  // find stylist profile for this user
  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  if (!profile) {
    res.json([]);
    return;
  }

  const invitations = await db
    .select({
      id: bookingTeamMembersTable.id,
      appointmentId: bookingTeamMembersTable.appointmentId,
      role: bookingTeamMembersTable.role,
      payoutPercentage: bookingTeamMembersTable.payoutPercentage,
      status: bookingTeamMembersTable.status,
      isLead: bookingTeamMembersTable.isLead,
      createdAt: bookingTeamMembersTable.createdAt,
      date: appointmentsTable.date,
      time: appointmentsTable.time,
      clientName: appointmentsTable.clientName,
      serviceName: appointmentsTable.serviceName,
      price: appointmentsTable.price,
    })
    .from(bookingTeamMembersTable)
    .innerJoin(appointmentsTable, eq(bookingTeamMembersTable.appointmentId, appointmentsTable.id))
    .where(
      and(
        eq(bookingTeamMembersTable.stylistId, profile.id),
        eq(bookingTeamMembersTable.status, "invited"),
      )
    );

  res.json(invitations.map(inv => ({
    ...inv,
    createdAt: inv.createdAt.toISOString(),
  })));
});

// Get all team members for an appointment
router.get("/appointments/:appointmentId/team-members", requireAuth, async (req, res) => {
  const members = await db
    .select()
    .from(bookingTeamMembersTable)
    .where(eq(bookingTeamMembersTable.appointmentId, req.params.appointmentId));

  res.json(members.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

// Lead artist adds team members to a booking
router.post("/appointments/:appointmentId/team-members", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { appointmentId } = req.params;
  const { stylistId, role, payoutPercentage, isLead } = req.body;

  if (!stylistId || !role || payoutPercentage == null) {
    res.status(400).json({ error: "stylistId, role, and payoutPercentage are required" });
    return;
  }
  if (payoutPercentage < 0 || payoutPercentage > 100) {
    res.status(400).json({ error: "payoutPercentage must be between 0 and 100" });
    return;
  }

  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, appointmentId));
  if (!appt) { res.status(404).json({ error: "Appointment not found" }); return; }

  // Verify the requester is the lead stylist or the client
  const [callerProfile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  const isClientOwner = appt.clientId === user.id;
  const isLeadStylist = callerProfile && appt.stylistId === callerProfile.id;
  if (!isClientOwner && !isLeadStylist) {
    res.status(403).json({ error: "Only the booking client or lead artist can add team members" });
    return;
  }

  const [targetProfile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.id, stylistId));
  if (!targetProfile) { res.status(404).json({ error: "Stylist not found" }); return; }

  // Check if already added
  const existing = await db.select().from(bookingTeamMembersTable)
    .where(and(eq(bookingTeamMembersTable.appointmentId, appointmentId), eq(bookingTeamMembersTable.stylistId, stylistId)));
  if (existing.length > 0) {
    res.status(409).json({ error: "This artist is already on the team" });
    return;
  }

  // If marking as team booking, update the appointment
  await db.update(appointmentsTable).set({ isTeamBooking: true }).where(eq(appointmentsTable.id, appointmentId));

  const [member] = await db.insert(bookingTeamMembersTable).values({
    id: randomUUID(),
    appointmentId,
    stylistId,
    stylistName: targetProfile.name,
    role,
    payoutPercentage,
    status: "invited",
    isLead: isLead ?? false,
  }).returning();

  res.status(201).json({ ...member, createdAt: member.createdAt.toISOString() });
});

// Artist accepts or declines a team invitation
router.patch("/appointments/:appointmentId/team-members/:memberId", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { appointmentId, memberId } = req.params;
  const { status } = req.body;

  if (!["confirmed", "declined"].includes(status)) {
    res.status(400).json({ error: "status must be 'confirmed' or 'declined'" });
    return;
  }

  const [profile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, user.id));
  if (!profile) { res.status(403).json({ error: "Only artists can respond to team invitations" }); return; }

  const [member] = await db.select().from(bookingTeamMembersTable)
    .where(and(eq(bookingTeamMembersTable.id, memberId), eq(bookingTeamMembersTable.appointmentId, appointmentId)));
  if (!member) { res.status(404).json({ error: "Invitation not found" }); return; }
  if (member.stylistId !== profile.id) { res.status(403).json({ error: "This invitation is not for you" }); return; }

  const [updated] = await db.update(bookingTeamMembersTable)
    .set({ status: status as "confirmed" | "declined" })
    .where(eq(bookingTeamMembersTable.id, memberId))
    .returning();

  // If all non-declined members have confirmed, mark appointment as confirmed
  if (status === "confirmed") {
    const allMembers = await db.select().from(bookingTeamMembersTable)
      .where(eq(bookingTeamMembersTable.appointmentId, appointmentId));
    const allAccepted = allMembers.every(m => m.status === "confirmed" || (m.id === memberId));
    if (allAccepted) {
      await db.update(appointmentsTable).set({ status: "confirmed" }).where(eq(appointmentsTable.id, appointmentId));
    }
  }

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

export default router;
