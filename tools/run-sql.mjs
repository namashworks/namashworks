// Runs _tools/query.sql against _tools/fixture.sql in a real in-memory SQLite
// database, so the numbers printed in assets/query.svg and in the README's
// fallback table are executed output, not something anyone typed by hand.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);   // fixture and query live in examples/ so they ship with the repo

export function runQuery() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(root, 'examples', 'fixture.sql'), 'utf8'));
  const rows = db.prepare(readFileSync(join(root, 'examples', 'query.sql'), 'utf8')).all();
  db.close();
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = runQuery();
  const cols = ['backend', 'mean_fidelity', 'scored', 'runs'];
  console.log(cols.join('  |  '));
  for (const r of rows) console.log(cols.map((c) => String(r[c])).join('  |  '));
  console.log('\nJSON:', JSON.stringify(rows));
}
