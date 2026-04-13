import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://evryruyibfibaplzurik.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

async function runSQL(sql, label) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    // Try the SQL editor endpoint instead
    const res2 = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!res2.ok) {
      const text = await res2.text();
      throw new Error(`${label}: ${res2.status} ${text.slice(0, 200)}`);
    }
    return await res2.json();
  }
  return await res.json();
}

async function run() {
  if (!SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_SERVICE_ROLE_KEY env var');
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Running ${file}...`);
    try {
      await runSQL(sql, file);
      console.log(`  Done.`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
  }

  console.log('All migrations attempted.');
}

run();
