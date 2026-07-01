import { runMigrations } from 'stripe-replit-sync';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL required');

console.log('Running Stripe migrations...');
await runMigrations({ databaseUrl, schema: 'stripe' });
console.log('Stripe migrations complete.');
