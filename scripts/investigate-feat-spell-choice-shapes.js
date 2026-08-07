/*
 * investigate-feat-spell-choice-shapes.js
 * ==========================================
 *
 * Step 6 slice d5a handled the 2 fully-fixed feats (Drow High Magic, Fey
 * Teleportation). The remaining 27 spell-granting feats
 * (investigate-feat-spells.js) all involve a player choice. Before slicing
 * d5b into pickers, this script groups those 27 by the STRUCTURE of the
 * choice: does one generic "pick N from <filter>" picker cover them, or do
 * they fall into genuinely distinct shapes needing separate handling?
 *
 * Cross-references investigate-feat-spell-ability.js for the ability source
 * per feat rather than re-deriving it.
 *
 * Investigation only, no implementation. Trimmed SUMMARY output only
 * (CLAUDE.md) — no whole additionalSpells dumps.
 *
 * Run: node scripts/investigate-feat-spell-choice-shapes.js
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

function truncate(obj, len = 200) {
	const s = JSON.stringify(obj);
	return s.length > len ? s.slice(0, len) + "…" : s;
}

function containsChoose(node) {
	if (node === null || typeof node !== "object") return false;
	if (Array.isArray(node)) return node.some(containsChoose);
	if (Object.prototype.hasOwnProperty.call(node, "choose")) return true;
	return Object.values(node).some(containsChoose);
}

const feats = readJson("feats.json");
const withSpells = feats.filter((f) => Array.isArray(f.additionalSpells) && f.additionalSpells.length > 0);
const FIXED_SPELL_FEATS = new Set(["Drow High Magic", "Fey Teleportation"]);

const choiceFeats = withSpells.filter((f) => !FIXED_SPELL_FEATS.has(f.name) && f.additionalSpells.some(containsChoose));
const nonChoiceRemainder = withSpells.filter((f) => !FIXED_SPELL_FEATS.has(f.name) && !f.additionalSpells.some(containsChoose));

console.log("SUMMARY");
console.log("total feats:", feats.length);
console.log("feats with additionalSpells:", withSpells.length);
console.log("fixed (d5a, already handled):", FIXED_SPELL_FEATS.size);
console.log("remaining with a `choose` node (this script's scope):", choiceFeats.length);
console.log("remaining WITHOUT a `choose` node (unexpected if >0):", nonChoiceRemainder.length);
for (const f of nonChoiceRemainder) console.log("  -", f.name, ":", truncate(f.additionalSpells));

// --- ability source per feat, cross-referenced (same logic as investigate-feat-spell-ability.js) ---
function abilitySource(f) {
	const values = new Set();
	for (const entry of f.additionalSpells) {
		if (entry.ability === undefined) values.add("NONE");
		else if (typeof entry.ability === "string") values.add(entry.ability);
		else values.add(JSON.stringify(entry.ability));
	}
	const v = [...values][0];
	if (v === "NONE") return "none (no ability field)";
	if (v === "inherit") return "inherit (existing spellcasting ability)";
	if (v.startsWith("{")) return "CHOICE " + v;
	return "FIXED " + v;
}

// --- classify each choice feat by structural shape ---
function classify(f) {
	const entries = f.additionalSpells;
	const allKeys = new Set();
	for (const e of entries) for (const k of Object.keys(e)) allKeys.add(k);

	// Eberron marks are recognizable by name pattern
	if (/^Mark of /.test(f.name)) return "D_MARK";

	// Boon of Siberys: array of NAMED alternative entries (choose ONE dragonmark), not a `choose` node inside one entry
	if (entries.length > 1 && entries.every((e) => typeof e.name === "string")) return "F_PICK_ONE_OF_NAMED_ALTERNATIVES";

	// Ritual Caster: prepared-spells choose block keyed by character level, filtered by ritual tag
	if (/Ritual Caster/i.test(f.name)) return "C_RITUAL";

	// School-restricted choice (Fey-Touched, Shadow-Touched): choose.school filter, plus a fixed bonus spell alongside
	const s = JSON.stringify(entries);
	if (/school=/.test(s)) return "B_SCHOOL_CHOICE";

	// Magic Initiate family: player chooses which CLASS list to draw cantrips + a level-1 spell from
	if (/Magic Initiate/i.test(f.name)) return "A_MAGIC_INITIATE";

	// Same mechanism as Magic Initiate (known/innate spell-from-class-at-level), but class is FIXED by the feat,
	// not chosen by the player (Artificer Initiate, Wood Elf Magic, Aberrant Dragonmark, Blessed Warrior, Druidic Warrior)
	if (allKeys.has("known") || (allKeys.has("innate") && allKeys.has("prepared") === false)) return "A2_FIXED_CLASS_SPELL_FROM_LIST";

	return "UNCATEGORIZED:" + JSON.stringify([...allKeys].sort());
}

const groups = new Map();
for (const f of choiceFeats) {
	const g = classify(f);
	if (!groups.has(g)) groups.set(g, []);
	groups.get(g).push(f);
}

heading("GROUPS (by structural shape)");
for (const [g, list] of [...groups.entries()].sort()) {
	console.log("\n---", g, "| count:", list.length, "---");
	for (const f of list) console.log("  -", f.name, "| ability source:", abilitySource(f));
}

// --- Detailed shape dump per group, trimmed, max 3 examples ---
heading("A. MAGIC INITIATE SHAPE — detail");
const groupA = groups.get("A_MAGIC_INITIATE") || [];
console.log("count:", groupA.length, "feats:", groupA.map((f) => f.name).join(", "));
for (const f of groupA.slice(0, 3)) {
	console.log("\n ", f.name, "(" + f.source + ") additionalSpells entries:");
	for (const e of f.additionalSpells) {
		console.log("   entry keys:", Object.keys(e));
		for (const [k, v] of Object.entries(e)) {
			if (k === "name") continue;
			console.log("     ", k, ":", truncate(v, 300));
		}
	}
}

heading("B. SCHOOL-RESTRICTED CHOICE SHAPE — detail");
const groupB = groups.get("B_SCHOOL_CHOICE") || [];
console.log("count:", groupB.length, "feats:", groupB.map((f) => f.name).join(", "));
for (const f of groupB.slice(0, 3)) {
	console.log("\n ", f.name, "(" + f.source + ") additionalSpells entries:");
	for (const e of f.additionalSpells) {
		console.log("   entry keys:", Object.keys(e));
		for (const [k, v] of Object.entries(e)) {
			if (k === "name") continue;
			console.log("     ", k, ":", truncate(v, 300));
		}
	}
}

heading("C. RITUAL CASTER SHAPE — detail");
const groupC = groups.get("C_RITUAL") || [];
console.log("count:", groupC.length, "feats:", groupC.map((f) => f.name).join(", "));
for (const f of groupC.slice(0, 3)) {
	console.log("\n ", f.name, "(" + f.source + ") additionalSpells entries:");
	for (const e of f.additionalSpells) {
		console.log("   entry keys:", Object.keys(e));
		for (const [k, v] of Object.entries(e)) {
			if (k === "name") continue;
			console.log("     ", k, ":", truncate(v, 400));
		}
	}
	// proficiency-bonus scaling / "N" is usually not in additionalSpells at all — check other fields
	console.log("   other top-level feat fields possibly relevant: prerequisite =", truncate(f.prerequisite, 150));
}

heading("D. ECBERRON 'MARK OF ...' SHAPE — detail (all, since this is the unknown group)");
const groupD = groups.get("D_MARK") || [];
console.log("count:", groupD.length, "feats:", groupD.map((f) => f.name).join(", "));
// Check consistency across ALL mark feats, not just 3, since this is the least-known group.
const markShapes = new Map();
for (const f of groupD) {
	for (const e of f.additionalSpells) {
		const keys = JSON.stringify(Object.keys(e).sort());
		if (!markShapes.has(keys)) markShapes.set(keys, []);
		markShapes.get(keys).push(f.name);
	}
}
console.log("\ndistinct entry-key shapes seen across all Mark feats:");
for (const [keys, names] of markShapes) {
	console.log("  shape", keys, "(" + names.length + " entries) e.g.:", names.slice(0, 3).join(", "));
}
console.log("\ntrimmed example entries (first 3 marks):");
for (const f of groupD.slice(0, 3)) {
	console.log("\n ", f.name, "(" + f.source + "):");
	for (const e of f.additionalSpells) {
		console.log("   keys:", Object.keys(e));
		for (const [k, v] of Object.entries(e)) {
			if (k === "name") continue;
			console.log("     ", k, ":", truncate(v, 300));
		}
	}
}
// does every mark's spell grant involve a choose, or do some mix fixed+choice?
console.log("\nper-mark: does EVERY additionalSpells entry contain a `choose` node, or does it mix fixed+choice?");
for (const f of groupD) {
	const flags = f.additionalSpells.map((e) => containsChoose(e));
	const allChoice = flags.every(Boolean);
	const noneChoice = flags.every((x) => !x);
	console.log(
		"  -",
		f.name,
		":",
		allChoice ? "ALL entries are choice" : noneChoice ? "ALL entries fixed (should not be in this list)" : "MIXED fixed+choice",
	);
}

heading("E. FIXED-SPELL-BUT-CHOSEN-ABILITY (Telekinetic, Telepathic) — sanity check");
for (const name of ["Telekinetic", "Telepathic"]) {
	const f = feats.find((x) => x.name === name);
	if (!f) {
		console.log("  -", name, ": NOT FOUND");
		continue;
	}
	const hasChoose = f.additionalSpells.some(containsChoose);
	console.log("  -", name, "| additionalSpells contains a `choose` node:", hasChoose, "| ability source:", abilitySource(f));
	if (!hasChoose) {
		console.log("     confirmed: no spell choice at all — spells are fixed grants, only the D57 chosenAbility is wired.");
	}
}

heading("A2. FIXED-CLASS SPELL-FROM-LIST SHAPE — detail (same mechanism as A, class not chosen)");
const groupA2 = groups.get("A2_FIXED_CLASS_SPELL_FROM_LIST") || [];
console.log("count:", groupA2.length, "feats:", groupA2.map((f) => f.name).join(", "));
for (const f of groupA2) {
	console.log("\n ", f.name, "(" + f.source + "):", truncate(f.additionalSpells, 300));
}

heading("F. PICK-ONE-OF-NAMED-ALTERNATIVES SHAPE — detail (Boon of Siberys)");
const groupF = groups.get("F_PICK_ONE_OF_NAMED_ALTERNATIVES") || [];
console.log("count:", groupF.length, "feats:", groupF.map((f) => f.name).join(", "));
for (const f of groupF) {
	console.log("\n ", f.name, "(" + f.source + ") — array of", f.additionalSpells.length, "named alternatives, player picks ONE:");
	for (const e of f.additionalSpells) console.log("   -", e.name, ":", truncate(e, 150));
}

heading("COULD GROUPS A/B/C SHARE ONE GENERIC PICKER?");
const aChoose = groupA[0]?.additionalSpells?.[0]?.innate?._?.daily?.["1"]?.[0]?.choose;
const bChoose = groupB[0]?.additionalSpells?.[0]?.innate?._?.daily?.["1e"]?.find((x) => x && x.choose)?.choose;
const cChoose = groupC[0]?.additionalSpells?.[0]?.prepared?.["1"]?.[0]?.choose;
console.log("A (Magic Initiate) choose filter, e.g.:", JSON.stringify(aChoose));
console.log("B (school choice) choose filter, e.g.:", JSON.stringify(bChoose));
console.log("C (ritual caster) choose filter, e.g.:", JSON.stringify(cChoose));
console.log(
	"note: all three use the SAME `{choose: \"level=N|<filter>\"}` string mini-language, just with a different filter",
	"clause (class=X, school=X;Y, components & miscellaneous=ritual) and a different count/placement (known vs innate",
	"vs prepared, and whether N picks is a flat number or keyed by character level).",
);

heading("RECONCILIATION");
const total = [...groups.values()].reduce((sum, l) => sum + l.length, 0);
console.log("groups found:", [...groups.keys()].join(", "));
console.log("sum across groups:", total, "| choiceFeats.length:", choiceFeats.length, "| match:", total === choiceFeats.length);
const uncategorized = [...groups.entries()].filter(([g]) => g.startsWith("UNCATEGORIZED"));
console.log("uncategorized groups:", uncategorized.length);
for (const [g, list] of uncategorized) {
	console.log("  shape", g, ":", list.map((f) => f.name).join(", "));
}

console.log("\ndone.");
