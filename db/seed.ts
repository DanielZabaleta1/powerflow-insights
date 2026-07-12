import 'dotenv/config';
import postgres from 'postgres';
import { generateDataset } from './generate.js';

// Runs once (or as many times as needed to reset the demo dataset) against
// SEED_DB_URL — an admin/service connection, never insights_readonly, since
// this script needs to TRUNCATE and INSERT. insights_readonly can only ever
// SELECT (see db/schema.sql).
const SEED_DB_URL = process.env.SEED_DB_URL;
if (!SEED_DB_URL) {
  throw new Error('SEED_DB_URL is not set. See .env.example — this must be an admin connection string, not DEMO_DB_URL.');
}

async function main() {
  const sql = postgres(SEED_DB_URL!, { ssl: 'require' });
  const { leads, activities } = generateDataset();

  try {
    await sql.begin(async (tx) => {
      // RESTART IDENTITY + CASCADE makes this idempotent: re-running the
      // script always reproduces the same ~500 leads instead of piling up
      // duplicates. CASCADE also clears demo.activities via the FK.
      await tx`truncate table demo.leads restart identity cascade`;

      const insertedLeads = await tx`
        insert into demo.leads ${tx(leads, 'name', 'company', 'channel', 'company_size', 'country', 'status', 'created_at')}
        returning id
      `;

      const activityRows = activities.map((a) => ({
        lead_id: insertedLeads[a.leadIndex].id,
        type: a.type,
        occurred_at: a.occurred_at,
      }));

      // Batch insert in chunks to keep individual statements reasonable.
      const CHUNK = 500;
      for (let i = 0; i < activityRows.length; i += CHUNK) {
        const chunk = activityRows.slice(i, i + CHUNK);
        await tx`insert into demo.activities ${tx(chunk, 'lead_id', 'type', 'occurred_at')}`;
      }

      console.log(`Seeded ${insertedLeads.length} leads and ${activityRows.length} activities into demo.*`);
    });
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
