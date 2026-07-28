/*
 * investigate-fighting-style.js
 * ===============================
 *
 * One-off investigation for the fighting style picker slice. Confirms the
 * shape of feats.json FS entries and class-features.json "Fighting Style"
 * entries before writing fightingStyleData.ts. Prints a SUMMARY ONLY (per
 * CLAUDE.md) — never whole entries or files.
 *
 * Run: node scripts/investigate-fighting-style.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

function truncate(str, max) {
	const s = String(str);
	return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

function heading(title) {
	console.log("");
	console.log("=".repeat(64));
	console.log(title);
	console.log("=".repeat(64));
}

heading("Q1. feats.json entries with category === 'FS'");
{
	const feats = readJson("feats.json");
	const fs_ = feats.filter((e) => e.category === "FS");
	console.log(`FS feats found: ${fs_.length}`);
	console.log(`Top-level keys on first FS feat: ${Object.keys(fs_[0]).join(", ")}`);
	console.log(`typeof entries: ${Array.isArray(fs_[0].entries) ? "array" : typeof fs_[0].entries}`);
	for (const f of fs_.slice(0, 3)) {
		console.log(`  ${f.name} (${f.source}): entries[0] = ${truncate(JSON.stringify(f.entries[0]), 150)}`);
	}
	console.log("All FS feat names:");
	console.log("  " + fs_.map((f) => f.name).join(", "));
}

heading("Q2. class-features.json 'Fighting Style' entries — full shape");
{
	const classFeatures = readJson("class-features.json");
	const fsFeatures = classFeatures.filter((e) => e.name === "Fighting Style");
	console.log(`"Fighting Style" class features found: ${fsFeatures.length}`);
	for (const f of fsFeatures) {
		console.log(`  keys: ${Object.keys(f).join(", ")}`);
		console.log(
			`  className=${f.className} classSource=${f.classSource} level=${f.level} source=${f.source}`,
		);
	}
}

console.log("");
