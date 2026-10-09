export const LEGAL_IDENTITY = {
  brand: "Bonisa",
  operator: "OPUS INTELLIGENCE (Pty) Ltd",
  cipcRegistrationNumber: "2025/416453/07",
  registeredOffice: "76 Stiglingh Road, Woodmead, Sandton, 2191, South Africa",
  businessEmail: "bonjourbonisa7@gmail.com",
  privacyEmail: "alwandekhoza6@gmail.com",
} as const;

/**
 * Version of each legal document, as shown to people at signup. When the
 * wording of a document changes, update the date here and in
 * artifacts/api-server/src/lib/legalVersions.ts. The server rejects a signup
 * made against an out-of-date version.
 */
export const LEGAL_VERSIONS = {
  terms: "2026-10-09",
  clientTerms: "2026-10-09",
  artistAgreement: "2026-10-09",
  privacy: "2026-10-09",
  marketing: "2026-10-09",
} as const;
