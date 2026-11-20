// Leonida Key Art — entrypoint. Copies the static app and its screenshots
// into the output directory, then writes the dossier with the kit library.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, 'app');
const shotsDir = path.join(here, 'screenshots');

function clearDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

function copyDir(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src).sort()) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

export async function main(): Promise<void> {
  // NOTE: never remove outDir itself — in the grader it is a bind-mount,
  // so only its contents are cleared (see clearDir above).
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  fs.mkdirSync(outDir, { recursive: true });
  const outApp = path.join(outDir, 'app');
  const outShots = path.join(outDir, 'screenshots');
  clearDir(outApp);
  clearDir(outShots);
  // Copy the app in a stable order so the dossier listing is deterministic.
  for (const name of fs.readdirSync(appDir).sort()) {
    const src = path.join(appDir, name);
    const dst = path.join(outApp, name);
    if (fs.statSync(src).isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
  if (fs.existsSync(shotsDir)) {
    for (const name of fs.readdirSync(shotsDir).sort()) {
      const src = path.join(shotsDir, name);
      if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(outShots, name));
    }
  }
  // The scorer's own caps: only text_max_bytes shapes the bytes; the others
  // refuse an entry the scorer would refuse (more than 4 screenshots or one
  // over 256 KiB; more than 993 files in app/ or 48 MiB of app files, or a
  // path under app/ over 1000 bytes). buildDossier reads the copied app/
  // and screenshots/ from the output dir and returns the dossier text.
  fs.writeFileSync(
    path.join(outDir, 'dossier.json'),
    buildDossier(outDir, {
      text_max_bytes: 163840,
      screenshots: { max: 4, max_bytes: 262144 },
      app_max_files: 993,
      app_max_bytes: 50331648,
      app_path_max_bytes: 1000,
    }),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
