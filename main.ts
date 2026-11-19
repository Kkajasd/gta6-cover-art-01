// Vice Panel Press — entry program. Copies the app and its screenshots into the
// output directory and writes the dossier the scorer re-checks byte for byte.
// Node 22, standard library only; runs twice with identical bytes.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function clearDir(path: string) {
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
}

function main() {
  mkdirSync(outDir, { recursive: true });
  for (const name of ['app', 'screenshots', 'dossier.json']) clearDir(join(outDir, name));
  cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

main();
