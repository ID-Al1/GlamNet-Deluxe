export type ReputationTier = {
  label: string;
  nextLabel: string | null;
  nextScore: number | null;
};

export function getReputationTier(score: number | null | undefined): ReputationTier {
  const reputationScore = Math.max(0, Math.min(100, Math.round(score ?? 0)));

  if (reputationScore >= 85) {
    return { label: "Elite", nextLabel: null, nextScore: null };
  }
  if (reputationScore >= 70) {
    return { label: "Trusted", nextLabel: "Elite", nextScore: 85 };
  }
  if (reputationScore >= 40) {
    return { label: "Established", nextLabel: "Trusted", nextScore: 70 };
  }
  return { label: "Rising", nextLabel: "Established", nextScore: 40 };
}