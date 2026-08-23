/*
 * investigate-underscore-key-subclasses.js
 * =========================================
 *
 * Ahead of the "_" level-key fix in subclassPreparedSpells.ts (Archfey
 * Patron's Misty Step): classifies every level-map key found under any
 * subclass's additionalSpells `prepared`/`known`/`innate` field, across
 * ALL subclasses in classes.json — not just Archfey — so the fix's scope
 * (and any other subclass it newly affects) is known before shipping.
 * Prints a SUMMARY ONLY (per CLAUDE.md).
 *
 * Run: node scripts/investigate-underscore-key-subclasses.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FIXED_GRANT_KEYS = ["prepared", "known", "innate"];

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

function isRecord(v) {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function classifyKey(key) {
	if (key === "_") return "underscore";
	if (/^s[1-5]$/.test(key)) return "pact-slot-rank";
	if (Number.isFinite(Number(key))) return "numeric";
	return "other-unparseable";
}

const classes = readJson("classes.json");
const subclasses = classes.filter((e) => e.entryType === "subclass" && Array.isArray(e.additionalSpells));

const counts = { underscore: 0, "pact-slot-rank": 0, numeric: 0, "other-unparseable": 0 };
const underscoreSubclasses = [];
const otherUnparseable = [];

for (const sc of subclasses) {
	let scHasUnderscore = false;
	for (const entry of sc.additionalSpells) {
		if (!isRecord(entry)) continue;
		for (const key of FIXED_GRANT_KEYS) {
			const levelMap = entry[key];
			if (!isRecord(levelMap)) continue;
			for (const levelKey of Object.keys(levelMap)) {
				const kind = classifyKey(levelKey);
				counts[kind]++;
				if (kind === "underscore") scHasUnderscore = true;
				if (kind === "other-unparseable") {
					otherUnparseable.push(`${sc.name} (${sc.source}) className=${sc.className} field=${key} key=${JSON.stringify(levelKey)}`);
				}
			}
		}
	}
	if (scHasUnderscore) {
		underscoreSubclasses.push(`${sc.name} (${sc.source}) className=${sc.className} classSource=${sc.classSource}`);
	}
}

console.log("Level-map key counts across all subclasses' prepared/known/innate fields:");
console.log(`  numeric (class level):     ${counts.numeric}`);
console.log(`  "_" (always granted):      ${counts.underscore}`);
console.log(`  pact-slot-rank (s1-s5):    ${counts["pact-slot-rank"]} (belongs to \`expanded\`, not these keys, if any found here)`);
console.log(`  other/unparseable:         ${counts["other-unparseable"]}`);

console.log("");
console.log(`Subclasses with at least one "_" key: ${underscoreSubclasses.length}`);
for (const line of underscoreSubclasses) console.log(`  ${line}`);

if (otherUnparseable.length > 0) {
	console.log("");
	console.log("Other unparseable keys found (must be skipped cleanly, not treated as always-granted):");
	for (const line of otherUnparseable.slice(0, 10)) console.log(`  ${line}`);
	if (otherUnparseable.length > 10) console.log(`  ...and ${otherUnparseable.length - 10} more`);
}
