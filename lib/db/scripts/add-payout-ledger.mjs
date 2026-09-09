import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");
const pool = new Pool({ connectionString: databaseUrl });
await pool.query(`
  CREATE TABLE IF NOT EXISTS payout_batches (
    id text PRIMARY KEY,
    artist_profile_id text NOT NULL REFERENCES stylist_profiles(id),
    total_amount real NOT NULL,
    line_count integer NOT NULL,
    reference text NOT NULL,
    paid_by text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS payout_ledger (
    id text PRIMARY KEY,
    appointment_id text NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    artist_profile_id text NOT NULL REFERENCES stylist_profiles(id),
    share_percent real NOT NULL,
    gross_amount real NOT NULL,
    platform_fee_amount real NOT NULL,
    net_amount real NOT NULL,
    status text NOT NULL DEFAULT 'due',
    due_at timestamp NOT NULL,
    paid_at timestamp,
    paid_batch_id text REFERENCES payout_batches(id),
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS payout_ledger_appointment_artist_unique
    ON payout_ledger (appointment_id, artist_profile_id);
  DO $$ BEGIN
    ALTER TABLE payout_batches ADD CONSTRAINT payout_batches_paid_by_users_fk
      FOREIGN KEY (paid_by) REFERENCES users(id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
`);
// Backfill releases using the same cent allocation rules as the application.
const { rows: releases } = await pool.query(`
  SELECT appointments.*, released_events.released_at
  FROM appointments
  LEFT JOIN LATERAL (
    SELECT max(created_at) AS released_at
    FROM payout_events
    WHERE payout_events.appointment_id = appointments.id
      AND payout_events.type = 'released'
  ) released_events ON true
  WHERE appointments.payout_status = 'released'
`);
for (const appointment of releases) {
  const { rows: members } = appointment.is_team_booking
    ? await pool.query(`SELECT stylist_id, payout_percentage FROM booking_team_members
      WHERE appointment_id = $1 AND status = 'confirmed'`, [appointment.id])
    : { rows: [] };
  if (!members.some((m) => m.stylist_id === appointment.stylist_id)) {
    members.unshift({ stylist_id: appointment.stylist_id, payout_percentage: 100 });
  }
  const lead = members.find((m) => m.stylist_id === appointment.stylist_id);
  const others = members.filter((m) => m.stylist_id !== appointment.stylist_id);
  const percentages = others.map((member) => Number(member.payout_percentage));
  if (
    percentages.some((percentage) => !Number.isFinite(percentage) || percentage < 0)
    || percentages.reduce((sum, percentage) => sum + percentage, 0) > 100
  ) {
    throw new Error(`Invalid team payout allocation for appointment ${appointment.id}`);
  }
  const poolCents = Math.max(0, Math.round(Number(appointment.artist_payout_amount) * 100));
  const feeCents = Math.max(0, Math.round(Number(appointment.platform_fee_amount) * 100));
  const allocations = others.map((m) => ({
    id: m.stylist_id,
    amount: Math.floor(poolCents * Number(m.payout_percentage) / 100),
    fee: Math.floor(feeCents * Number(m.payout_percentage) / 100),
    pct: Number(m.payout_percentage),
  }));
  const used = allocations.reduce((n, x) => n + x.amount, 0);
  const usedFee = allocations.reduce((n, x) => n + x.fee, 0);
  allocations.push({ id: appointment.stylist_id, amount: poolCents - used,
    fee: feeCents - usedFee, pct: Number(lead?.payout_percentage ?? 100) });
  // Old releases normally have an append-only release event. If one is
  // missing, start the 24-hour payout window when this backfill runs rather
  // than incorrectly treating the booking creation date as the release.
  const releasedAt = appointment.released_at ? new Date(appointment.released_at) : new Date();
  const dueAt = new Date(releasedAt.getTime() + 24 * 60 * 60 * 1000);
  for (const a of allocations) {
    await pool.query(`INSERT INTO payout_ledger
      (id, appointment_id, artist_profile_id, share_percent, gross_amount, platform_fee_amount, net_amount, status, due_at)
      VALUES ($1, $2, $3, $4, $5, $6, $5, 'due', $7)
      ON CONFLICT (appointment_id, artist_profile_id) DO NOTHING`,
      [randomUUID(), appointment.id, a.id, poolCents ? a.amount / poolCents * 100 : 0, a.amount / 100, a.fee / 100,
        dueAt]);
  }
}
await pool.end();