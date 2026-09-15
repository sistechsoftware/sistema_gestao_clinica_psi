// Snapshot local via pg_dump (§43). Uso: npm run db:snapshot
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL/DIRECT_URL não definida');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync('backups', { recursive: true });
const out = join('backups', `snapshot-${stamp}.sql`);

const proc = spawn('pg_dump', [url, '-f', out], { stdio: 'inherit' });
proc.on('error', () => {
  console.error('pg_dump não encontrado — instale o PostgreSQL client tools.');
  process.exit(1);
});
proc.on('exit', (code) => {
  if (code === 0) console.log(`snapshot salvo em ${out}`);
  else process.exit(code ?? 1);
});
