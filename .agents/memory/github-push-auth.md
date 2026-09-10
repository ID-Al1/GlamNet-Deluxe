---
name: GitHub push authentication
description: Covers the Replit-specific mismatch between Git CLI credentials and an attached GitHub connector.
---

The Git remote can continue using an invalid workspace PAT after a GitHub App connection is attached, even when the connector itself is healthy and has repository write access.

**Why:** Repeated normal pushes and credential-helper retries can fail while authenticated GitHub API writes through the connector still succeed. GitHub's commit API normalizes commit metadata, so API-created commit SHAs may differ from existing local SHAs even when the tree and message match.

**How to apply:** Try the normal Git push once after attaching the GitHub App. If it still reports invalid credentials, stop retrying stale credentials. Use the authenticated connector API carefully, preserve ancestry and tree hashes, and verify the final local and remote branch SHAs explicitly.