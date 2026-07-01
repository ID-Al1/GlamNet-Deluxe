import { Router } from "express";
import { db, referralsTable, usersTable, appointmentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// Config: bonus amount in ZAR (set REFERRAL_BONUS_ZAR env var; defaults to 0 until Alwande sets it)
const REFERRAL_BONUS_ZAR = Number(process.env.REFERRAL_BONUS_ZAR ?? 0);

// Artist views their referrals and pending bonus
router.get("/referrals", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const referrals = await db
    .select({
      id: referralsTable.id,
      referredId: referralsTable.referredId,
      referredType: referralsTable.referredType,
      status: referralsTable.status,
      bonusPaid: referralsTable.bonusPaid,
      createdAt: referralsTable.createdAt,
      referredName: usersTable.name,
    })
    .from(referralsTable)
    .leftJoin(usersTable, eq(referralsTable.referredId, usersTable.id))
    .where(eq(referralsTable.referrerId, user.id));

  const pendingCount = referrals.filter(r => r.status === "pending").length;
  const completedUnpaid = referrals.filter(r => r.status === "completed" && !r.bonusPaid).length;
  const pendingBonusZAR = completedUnpaid * REFERRAL_BONUS_ZAR;

  res.json({
    referrals: referrals.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    bonusPerReferral: REFERRAL_BONUS_ZAR,
    pendingBonusZAR,
    totalReferrals: referrals.length,
    completedReferrals: referrals.filter(r => r.status === "completed").length,
  });
});

// Internal helper: complete a referral when referred user finishes their first booking
export async function maybeCompleteReferral(userId: string) {
  const [referral] = await db
    .select()
    .from(referralsTable)
    .where(and(eq(referralsTable.referredId, userId), eq(referralsTable.status, "pending")));

  if (!referral) return;

  // Check they have at least one completed appointment
  const completed = await db
    .select()
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.clientId, userId), eq(appointmentsTable.status, "completed")));

  if (completed.length >= 1) {
    await db.update(referralsTable)
      .set({ status: "completed" })
      .where(eq(referralsTable.id, referral.id));
  }
}

export default router;
