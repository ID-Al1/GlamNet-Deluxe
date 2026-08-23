---
name: Private identity verification
description: Security boundary for artist ID numbers and identity-document uploads.
---

Artist identity numbers and identity documents are private verification records. They must be uploaded through a dedicated private flow, attached only after confirming the authenticated artist uploaded the object, and reviewed only through owner-authorized API endpoints.

**Why:** Generic media routes and public-serving storage paths are intended for profiles, reviews, and messages. Reusing them risks exposing identity documents or relying on ephemeral upload ownership.

**How to apply:** Keep raw ID values and document paths out of public serializers, search results, logs, and browser-visible profile state. If verification storage or access changes, preserve the private object path, owner-only document stream, no-store response headers, and the shared readiness gate.