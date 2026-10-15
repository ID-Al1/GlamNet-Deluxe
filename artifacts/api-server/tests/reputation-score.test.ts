import test from "node:test";
import assert from "node:assert/strict";
import { REPUTATION_CONFIG as CFG, validateReputationConfig } from "../src/lib/reputation-config";
import {
  cancellationKind, clamp, communityScore, consistencyScore, nextTierProgress, overallScore, professionalismScore,
  qualifyingTier, reliabilityScore, satisfactionScore,
} from "../src/lib/reputation-score";

const full = { completedBookings: 100, monthsSinceVerified: 24, evidenceSufficient: true };

test("settings are valid and weights add up to 1", () => {
  assert.deepEqual(validateReputationConfig(), []);
  assert.equal(Object.values(CFG.weights).reduce((a, b) => a + b, 0), 1);
});

test("overall is the weighted sum of the five categories", () => {
  const o = overallScore({ reliability: 100, satisfaction: 80, professionalism: 60, consistency: 40, community: 20 });
  assert.ok(Math.abs(o - (30 + 24 + 12 + 6 + 1)) < 1e-9);
});

test("scores are clamped to 0..100 and never rounded before tier evaluation", () => {
  assert.equal(clamp(140), 100);
  assert.equal(clamp(-5), 0);
  assert.equal(overallScore({ reliability: 200, satisfaction: 200, professionalism: 200, consistency: 200, community: 200 }), 100);
  // 74.99 must NOT round up into Signature (75).
  assert.equal(qualifyingTier({ ...full, score: 74.99 }).key, "rising");
});

test("tier boundaries: 59.99, 60, 74.99, 75, 84.99, 85, 92.99, 93, 100", () => {
  const t = (score: number) => qualifyingTier({ ...full, score }).key;
  assert.equal(t(59.99), "new_talent");
  assert.equal(t(60), "rising");
  assert.equal(t(74.99), "rising");
  assert.equal(t(75), "signature");
  assert.equal(t(84.99), "signature");
  assert.equal(t(85), "elite");
  assert.equal(t(92.99), "elite");
  assert.equal(t(93), "icon");
  assert.equal(t(100), "icon");
});

test("a tier needs the score AND the bookings AND the time", () => {
  // High score alone unlocks nothing beyond what her bookings and months allow.
  assert.equal(qualifyingTier({ score: 99, completedBookings: 5, monthsSinceVerified: 0, evidenceSufficient: true }).key, "rising");
  assert.equal(qualifyingTier({ score: 99, completedBookings: 15, monthsSinceVerified: 2, evidenceSufficient: true }).key, "rising");
  assert.equal(qualifyingTier({ score: 99, completedBookings: 15, monthsSinceVerified: 3, evidenceSufficient: true }).key, "signature");
  assert.equal(qualifyingTier({ score: 99, completedBookings: 29, monthsSinceVerified: 12, evidenceSufficient: true }).key, "signature");
  assert.equal(qualifyingTier({ score: 99, completedBookings: 30, monthsSinceVerified: 6, evidenceSufficient: true }).key, "elite");
  assert.equal(qualifyingTier({ score: 99, completedBookings: 60, monthsSinceVerified: 11, evidenceSufficient: true }).key, "elite");
  assert.equal(qualifyingTier({ score: 99, completedBookings: 60, monthsSinceVerified: 12, evidenceSufficient: true }).key, "icon");
  // Plenty of bookings and time but a weak score stays low.
  assert.equal(qualifyingTier({ score: 50, completedBookings: 80, monthsSinceVerified: 20, evidenceSufficient: true }).key, "new_talent");
});

test("a new artist is Building reputation, never a punitive zero", () => {
  assert.equal(qualifyingTier({ score: 99, completedBookings: 4, monthsSinceVerified: 6, evidenceSufficient: false }).key, "new_talent");
  // With no history at all every category starts at a fair neutral, not 0.
  assert.ok(reliabilityScore({ completed: 0, lateCancels: 0, lastMinuteCancels: 0, noShows: 0 }) >= 75);
  assert.ok(satisfactionScore(0, 0) >= 70);
  assert.ok(professionalismScore([]) >= 80);
  assert.ok(consistencyScore({ completedInWindow: 0, failuresInWindow: 0, activeMonths: 0, monthsSinceVerified: 0 }) >= 75);
  assert.ok(communityScore(0) > 0);
});

test("no-show hurts more than a late cancellation, and a last-minute one sits between", () => {
  const base = { completed: 20, lateCancels: 0, lastMinuteCancels: 0, noShows: 0 };
  const clean = reliabilityScore(base);
  const late = reliabilityScore({ ...base, lateCancels: 1 });
  const lastMin = reliabilityScore({ ...base, lastMinuteCancels: 1 });
  const noShow = reliabilityScore({ ...base, noShows: 1 });
  assert.ok(clean > late && late > lastMin && lastMin > noShow);
});

test("one event cannot destroy a good record", () => {
  const score = reliabilityScore({ completed: 30, lateCancels: 0, lastMinuteCancels: 0, noShows: 1 });
  assert.ok(score > 80, `expected a good record to survive one no-show, got ${score}`);
});

test("cancellation notice: 48h or more is free, 12 to 48 late, under 12 last-minute", () => {
  assert.equal(cancellationKind(72), "free");
  assert.equal(cancellationKind(48), "free");
  assert.equal(cancellationKind(47.9), "late_cancel");
  assert.equal(cancellationKind(12), "late_cancel");
  assert.equal(cancellationKind(11.9), "last_minute_cancel");
  assert.equal(cancellationKind(0.5), "last_minute_cancel");
});

test("satisfaction is smoothed: one bad review does not sink a new artist", () => {
  const oneStar = satisfactionScore(1, 1);
  assert.ok(oneStar > 55, `one 1-star review gave ${oneStar}`);
  const manyGood = satisfactionScore(5 * 40, 40);
  assert.ok(manyGood > 90);
  assert.ok(satisfactionScore(5 * 40, 40) > satisfactionScore(5 * 3, 3), "more evidence moves her further from the neutral start");
});

test("professionalism only drops for confirmed cases, and recovers", () => {
  assert.equal(professionalismScore([{ type: "conduct_minor", ageDays: 10 }]), CFG.professionalism.baseline - 5);
  assert.equal(professionalismScore([{ type: "conduct_serious", ageDays: 10 }]), CFG.professionalism.baseline - 15);
  assert.equal(professionalismScore([{ type: "conduct_serious", ageDays: 400 }]), CFG.professionalism.baseline);
});

test("consistency does not punish quiet months, and rewards steady activity", () => {
  const quiet = consistencyScore({ completedInWindow: 0, failuresInWindow: 0, activeMonths: 0, monthsSinceVerified: 8 });
  const steady = consistencyScore({ completedInWindow: 20, failuresInWindow: 0, activeMonths: 5, monthsSinceVerified: 8 });
  const flaky = consistencyScore({ completedInWindow: 20, failuresInWindow: 8, activeMonths: 5, monthsSinceVerified: 8 });
  assert.ok(quiet > 50, "inactivity is not treated as misconduct");
  assert.ok(steady > quiet && steady > flaky);
});

test("community influence is capped and cannot exceed its 5% weight", () => {
  assert.equal(communityScore(4), communityScore(40), "credits beyond the cap add nothing");
  assert.ok(communityScore(4) <= 100);
  const withMax = overallScore({ reliability: 80, satisfaction: 80, professionalism: 80, consistency: 80, community: communityScore(40) });
  const withNone = overallScore({ reliability: 80, satisfaction: 80, professionalism: 80, consistency: 80, community: communityScore(0) });
  assert.ok(withMax - withNone <= CFG.weights.community * 100 + 1e-9);
});

test("next-tier progress never says unlocked while anything is missing", () => {
  const p = nextTierProgress("rising", { score: 80, completedBookings: 10, monthsSinceVerified: 1, evidenceSufficient: true })!;
  assert.equal(p.tier, "signature");
  assert.equal(p.pointsNeeded, 0);
  assert.equal(p.bookingsNeeded, 5);
  assert.equal(p.monthsNeeded, 2);
  assert.equal(nextTierProgress("icon", { ...full, score: 99 }), null);
});
