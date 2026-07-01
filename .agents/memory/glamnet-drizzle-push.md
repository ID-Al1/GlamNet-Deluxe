---
name: GlamNet drizzle-kit push workaround
description: drizzle-kit push fails non-interactively when adding unique constraints to tables that already have rows; use direct SQL instead.
---

## Rule
Never use `drizzle-kit push` to add a UNIQUE constraint to a table that already has data rows. It triggers an interactive "do you want to truncate?" prompt that fails in a non-TTY shell.

**Why:** The sandbox has no TTY (process.stdin.isTTY is false), so drizzle-kit's interactive safety check always throws.

**How to apply:** For any schema change that modifies existing tables with a new UNIQUE constraint:
1. Run the ALTER TABLE manually with `node -e "..."` using the pg module at `/home/runner/workspace/node_modules/.pnpm/pg@8.22.0/node_modules/pg`
2. Populate all existing rows with unique values first
3. Then add the constraint with `ADD CONSTRAINT IF NOT EXISTS ... UNIQUE`
4. Only then run `drizzle-kit push` (or skip it entirely for that column — it already exists in the DB)

For brand-new tables (no existing rows), `drizzle-kit push` works fine.
