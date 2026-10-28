import { randomBytes } from "crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  db, usersTable, stylistProfilesTable, appointmentsTable, bankAccountsTable, portfolioItemsTable,
  aftercarePagesTable, bookingTeamMembersTable, castingApplicationsTable, castingCallsTable,
  messagesTable, conversationsTable, payoutLedgerTable, complaintsTable,
} from "@workspace/db";

const OPEN_COMPLAINT_STATUSES = ["new", "under_review", "waiting_for_client", "waiting_for_artist", "escalated"];

export interface DeletionBlockers {
  isOwnerAccount: boolean;
  openBookings: number;
  moneyHeld: number;
  moneyOwed: number;
  openComplaints: number;
}

export const hasBlockers = (b: DeletionBlockers) =>
  b.isOwnerAccount || b.openBookings > 0 || b.moneyHeld > 0 || b.moneyOwed > 0 || b.openComplaints > 0;

/**
 * What stops an account from being deleted right now. Money and live bookings
 * must be settled first, because deleting would leave someone unpaid or stranded.
 */
export async function deletionBlockers(userId: string, executor: any = db): Promise<DeletionBlockers> {
  const [user] = await executor.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId));
  const ownerEmail = process.env["OWNER_EMAIL"]?.trim().toLowerCase();
  const [profile] = await executor.select({ id: stylistProfilesTable.id }).from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, userId));

  // Bookings the person is in, as the client or as the artist.
  const mine = profile
    ? or(eq(appointmentsTable.clientId, userId), eq(appointmentsTable.stylistId, profile.id))
    : eq(appointmentsTable.clientId, userId);
  const [open] = await executor.select({ n: sql<number>`count(*)::int` }).from(appointmentsTable)
    .where(and(mine, inArray(appointmentsTable.status, ["pending", "confirmed"])));
  const [held] = await executor.select({ n: sql<number>`count(*)::int` }).from(appointmentsTable)
    .where(and(mine, inArray(appointmentsTable.payoutStatus, ["held", "disputed"]),
      sql`${appointmentsTable.artistPayoutAmount} > 0`, inArray(appointmentsTable.status, ["pending", "confirmed", "completed"])));
  const [owed] = profile
    ? await executor.select({ n: sql<number>`count(*)::int` }).from(payoutLedgerTable)
        .where(and(eq(payoutLedgerTable.artistProfileId, profile.id), eq(payoutLedgerTable.status, "due")))
    : [{ n: 0 }];
  const [complaints] = await executor.select({ n: sql<number>`count(*)::int` }).from(complaintsTable)
    .where(and(or(eq(complaintsTable.complainantUserId, userId), eq(complaintsTable.subjectUserId, userId)),
      inArray(complaintsTable.status, OPEN_COMPLAINT_STATUSES)));

  return {
    isOwnerAccount: !!ownerEmail && user?.email.trim().toLowerCase() === ownerEmail,
    openBookings: open?.n ?? 0, moneyHeld: held?.n ?? 0, moneyOwed: owed?.n ?? 0, openComplaints: complaints?.n ?? 0,
  };
}

/**
 * Removes a person's details and keeps what the law and fairness require.
 * Removed: name, email, phone, photo, ID number and document, bank details,
 * bio and links, safety contact, portfolio, aftercare pages, their chat words,
 * and names on their bookings. Kept without a name: booking and payment records.
 * Returns the stored ID document, which the caller deletes from file storage.
 */
export async function anonymiseUser(tx: any, userId: string): Promise<{ idDocumentPath: string | null }> {
  const [profile] = await tx.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, userId));

  await tx.update(usersTable).set({
    name: "Deleted user",
    email: `deleted-${userId}@deleted.invalid`,
    phone: null, avatarUrl: null, businessName: null, stripeCustomerId: null, referralCode: null,
    // Random 64 character value, the same length as a real hash, so nobody can sign in.
    passwordHash: randomBytes(32).toString("hex"),
    accountStatus: "suspended",
    anonymisedAt: new Date(),
  }).where(eq(usersTable.id, userId));

  // Their words in chat, and the names on their bookings.
  await tx.update(messagesTable).set({ senderName: "Deleted user", content: "[Message removed]", mediaUrl: null })
    .where(eq(messagesTable.senderId, userId));
  await tx.update(conversationsTable).set({ lastMessage: null })
    .where(or(eq(conversationsTable.clientId, userId), eq(conversationsTable.stylistId, userId)));
  await tx.update(appointmentsTable).set({ clientName: "Deleted user", notes: null }).where(eq(appointmentsTable.clientId, userId));
  await tx.update(castingCallsTable).set({ brandName: "Deleted brand" }).where(eq(castingCallsTable.brandId, userId));

  if (!profile) return { idDocumentPath: null };

  await tx.update(appointmentsTable).set({ stylistName: "Deleted artist" }).where(eq(appointmentsTable.stylistId, profile.id));
  await tx.update(bookingTeamMembersTable).set({ stylistName: "Deleted artist" }).where(eq(bookingTeamMembersTable.stylistId, profile.id));
  await tx.update(castingApplicationsTable).set({ stylistName: "Deleted artist" }).where(eq(castingApplicationsTable.stylistId, profile.id));
  // Bank rows are blanked rather than deleted: the log of who viewed them must stay.
  await tx.update(bankAccountsTable).set({ bankName: "Deleted", accountHolderName: "Deleted", accountNumber: "" })
    .where(eq(bankAccountsTable.stylistProfileId, profile.id));
  await tx.delete(portfolioItemsTable).where(eq(portfolioItemsTable.stylistId, profile.id));
  await tx.delete(aftercarePagesTable).where(eq(aftercarePagesTable.artistProfileId, profile.id));
  await tx.update(stylistProfilesTable).set({
    name: "Deleted artist", bio: null, instagram: null, website: null, location: "", area: "",
    idNumber: null, idDocumentUrl: null, safetyContactName: null, safetyContactPhone: null,
    // Hidden from browse and not bookable.
    verified: false, verificationStatus: "none", verificationRejectionReason: null,
  }).where(eq(stylistProfilesTable.id, profile.id));

  return { idDocumentPath: profile.idDocumentUrl ?? null };
}
