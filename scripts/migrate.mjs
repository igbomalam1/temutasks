import fs from 'fs';
import path from 'path';

const sqlPath = path.join(process.cwd(), 'supabase', 'schema.sql');
const fullSql = fs.readFileSync(sqlPath, 'utf8');

const projectRef = process.env.SUPABASE_PROJECT_REF || 'cxbevwccenradkjxoooh';
const token = process.env.SUPABASE_ACCESS_TOKEN || '';

// Split by blocks of statements
const statements = fullSql
  .split(/;\s*$/m)
  .map(s => s.trim())
  .filter(s => s.length > 0);

async function runQuery(query) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: query + ';' })
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Query failed: ${resp.status} ${txt}`);
  }
  return await resp.json();
}

async function main() {
  console.log(`Executing ${statements.length} SQL statements...`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await runQuery(stmt);
      console.log(`[${i + 1}/${statements.length}] Done`);
    } catch (e) {
      console.error(`Error at statement ${i + 1}:`, stmt.substring(0, 80), e.message);
    }
  }
  console.log('Migration finished!');
}

main();
