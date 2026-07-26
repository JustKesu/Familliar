/*
 * copy-data.js
 * ============
 *
 * WHAT THIS SCRIPT DOES
 * ---------------------
 * The app fetches the extracted game data over HTTP at runtime, so the JSON
 * files have to sit inside Vite's `public/` folder to be served. But `data/`
 * at the repo root stays the single source of truth — it is what
 * `extract-data.js` writes and what git tracks.
 *
 * This script copies `data/` -> `public/data/`. `public/data/` is a build
 * artefact: it is gitignored and safe to delete at any time.
 *
 * HOW TO RUN IT
 * -------------
 * It runs automatically before `npm run dev` and `npm run build` (see the
 * `predev` / `prebuild` entries in package.json). To run it by hand:
 *
 *     npm run copy-data
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "data");
const TARGET_DIR = path.join(ROOT, "public", "data");

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`copy-data: source folder not found: ${SOURCE_DIR}`);
    console.error("copy-data: run `node scripts/extract-data.js` first.");
    process.exit(1);
  }

  // Wipe the target first so files deleted from data/ do not linger here.
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => name.endsWith(".json"));

  if (files.length === 0) {
    console.error(`copy-data: no .json files found in ${SOURCE_DIR}`);
    process.exit(1);
  }

  for (const name of files) {
    fs.copyFileSync(path.join(SOURCE_DIR, name), path.join(TARGET_DIR, name));
  }

  console.log(`copy-data: copied ${files.length} file(s) to public/data/`);
}

main();
