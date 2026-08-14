---
name: GlamNet API field additions
description: How to safely add a new field to a stylist/API response without breaking frontend typecheck.
---

A database column existing and even being returned at runtime by an Express route does not mean the field is typed for frontend consumption. GlamNet's frontend types are generated (via orval) from `lib/api-spec/openapi.yaml`, not from the DB schema or the route handler.

**Why:** frontend code that reads a field the route returns but the OpenAPI schema doesn't declare will compile against a type missing that field, and using it anyway breaks `pnpm typecheck`.

**How to apply:** when a route already returns a DB-backed field that isn't in the frontend types yet, add the property to the relevant schema in `lib/api-spec/openapi.yaml`, then run `pnpm --filter @workspace/api-spec run codegen` before referencing it in React code.
