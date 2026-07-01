---
name: GlamNet schema decisions
description: Key DB schema facts and decisions for the GlamNet Drizzle/Postgres schema.
---

- `servicesTable.stylistId` references `stylistProfilesTable.id` (the profile ID), NOT the user ID. Always query services by profile ID.
- `houseCalls boolean NOT NULL DEFAULT false` was added to `stylist_profiles` via `ALTER TABLE` (not via Drizzle push — no db:push script exists on @workspace/db).
- The generated zod schema (`lib/api-zod/src/generated/api.ts`) is manually edited to add `houseCalls: zod.boolean().optional()` to `UpdateMyStylistProfileBody` since codegen isn't re-run.
- `buildStylistResponse` in `artifacts/api-server/src/routes/stylists.ts` returns `houseCalls: profile.houseCalls` in the response object.
- The PATCH route handles `houseCalls` via `(data as any).houseCalls` because the TypeScript inference from the zod schema may not propagate to the compiled route type.

**Why:** Drizzle push would require a separate script setup; direct SQL ALTER TABLE is simpler for single column additions with defaults.
