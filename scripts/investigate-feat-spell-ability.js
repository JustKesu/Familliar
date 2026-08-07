/*
 * investigate-feat-spell-ability.js
 * ===================================
 *
 * Follow-up to investigate-feat-spells.js. That script found 29 feats grant
 * spells via `additionalSpells` and split them 4 fixed-spells / 25
 * choice-spells. This script answers a narrower question needed before d5's
 * picker is built: for EACH of the 29, does the `ability` field on the
 * additionalSpells entry name a FIXED spellcasting ability, offer the player
 * a CHOICE of ability (Magic Initiate's "choose int/wis/cha" shape), or say
 * "inherit" / omit the field entirely? The picker must only offer an ability
 * choice where the data actually calls for one (D46 pattern).
 *
 * Investigation only, no implementation. Trimmed SUMMARY output only
 * (CLAUDE.md) — no whole additionalSpells dumps.
 *
 * Run: node scripts/investigate-feat-spell-ability.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

function heading(title) {
	console.log("");
	console.log("=".repeat(64));
	console.log(title);
	console.log("=".repeat(64));
}

const feats = readJson("feats.json");
const withSpells = feats.filter((f) => Array.isArray(f.additionalSpells) && f.additionalSpells.length > 0);

console.log("SUMMARY");
console.log("total feats:", feats.length);
console.log("feats with additionalSpells:", withSpells.length);

// Collect the distinct `ability` value(s) each feat's additionalSpells entries carry.
const abilityByFeat = new Map();
for (const f of withSpells) {
	const values = new Set();
	for (const entry of f.additionalSpells) {
		if (entry.ability === undefined) values.add("NONE");
		else if (typeof entry.ability === "string") values.add(entry.ability);
		else values.add(JSON.stringify(entry.ability));
	}
	abilityByFeat.set(f.name, [...values]);
}

// Sanity check: does any feat mix more than one ability shape across its entries?
heading("0. FEATS WITH MULTIPLE DISTINCT ability VALUES ACROSS ENTRIES");
let mixedCount = 0;
for (const [name, values] of abilityByFeat) {
	if (values.length > 1) {
		mixedCount++;
		console.log("  -", name, ":", values.join(" | "));
	}
}
console.log(mixedCount === 0 ? "  none — every feat is internally consistent" : `  ${mixedCount} feat(s) mixed, see above`);

// --- Sort into a/b/c ---
const fixedAbility = []; // single named ability string, not "inherit"
const choiceAbility = []; // { choose: [...] }
const inheritOrUnspecified = []; // "inherit" or NONE

for (const [name, values] of abilityByFeat) {
	const v = values[0]; // entries are internally consistent per section 0
	if (v === "NONE" || v === "inherit") {
		inheritOrUnspecified.push({ name, value: v });
	} else if (v.startsWith("{")) {
		choiceAbility.push({ name, value: v });
	} else {
		fixedAbility.push({ name, value: v });
	}
}

heading("(a) FIXED ability — data names exactly one spellcasting ability");
console.log("count:", fixedAbility.length);
for (const { name, value } of fixedAbility) console.log("  -", name, ":", value);

heading("(b) CHOICE of ability — data offers a set to choose from");
console.log("count:", choiceAbility.length);
const choiceSets = new Map();
for (const { name, value } of choiceAbility) {
	if (!choiceSets.has(value)) choiceSets.set(value, []);
	choiceSets.get(value).push(name);
}
for (const [set, names] of choiceSets) {
	console.log("  set", set, "(" + names.length + " feats):");
	for (const n of names) console.log("    -", n);
}

heading("(c) INHERIT / unspecified");
console.log("count:", inheritOrUnspecified.length);
for (const { name, value } of inheritOrUnspecified) console.log("  -", name, ": ability field =", value);

heading("RECONCILIATION");
console.log(
	"a + b + c =",
	fixedAbility.length,
	"+",
	choiceAbility.length,
	"+",
	inheritOrUnspecified.length,
	"=",
	fixedAbility.length + choiceAbility.length + inheritOrUnspecified.length,
	"(should equal", withSpells.length + ")",
);

// --- Cross-reference with the 4 fixed-SPELL feats from investigate-feat-spells.js ---
heading("CROSS-REFERENCE: the 4 FIXED-SPELL feats — is their ABILITY also fixed?");
const fixedSpellFeatNames = ["Drow High Magic", "Fey Teleportation", "Telekinetic", "Telepathic"];
for (const name of fixedSpellFeatNames) {
	const values = abilityByFeat.get(name);
	if (!values) {
		console.log("  -", name, ": NOT FOUND in feats.json");
		continue;
	}
	const v = values[0];
	let verdict;
	if (v === "NONE") verdict = "no ability field at all";
	else if (v === "inherit") verdict = "INHERIT — not fixed, not a choice; derives from character's existing spellcasting ability";
	else if (v.startsWith("{")) verdict = "CHOICE — " + v;
	else verdict = "FIXED — " + v;
	console.log("  -", name, ": spells FIXED (from prior investigation); ability =", verdict);
}

heading("NOTES");
console.log("- Ritual Caster has NO `ability` key at all (distinct from the literal \"inherit\" string).");
console.log("  Its ritual spells come from a class the player picks when taking the feat; the ability");
console.log("  to use for them is not recorded anywhere in this feat's data. This is a data gap, not a");
console.log("  rules answer — do not guess which ability it should use.");
console.log("- All 17 CHOICE-ability feats offer the identical set [int, wis, cha] (Magic Initiate's set).");
console.log("- The 4 literal \"inherit\" feats (Fey-Touched, Shadow-Touched, Telekinetic, Telepathic) rely");
console.log("  on the character already having a spellcasting ability from class/subclass/species. For a");
console.log("  non-caster (e.g. a Fighter with Fey-Touched) the data gives no fallback — a rules call,");
console.log("  not something this script can resolve.");

console.log("\ndone.");
