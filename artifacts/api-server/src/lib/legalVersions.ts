/**
 * Current version of each legal document. Bump a value here and in
 * artifacts/glamnet/src/lib/legal.ts whenever the wording of that document
 * changes in a way people should re-accept or re-read.
 */
export const LEGAL_VERSIONS = {
  terms: "2026-10-09",
  clientTerms: "2026-10-09",
  artistAgreement: "2026-10-09",
  privacy: "2026-10-09",
  marketing: "2026-10-09",
} as const;

export function roleAgreementFor(role: "client" | "stylist" | "brand") {
  return role === "stylist"
    ? ({ type: "artist_agreement", version: LEGAL_VERSIONS.artistAgreement } as const)
    : ({ type: "client_terms", version: LEGAL_VERSIONS.clientTerms } as const);
}
