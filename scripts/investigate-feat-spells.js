/*
 * investigate-feat-spells.js
 * ===========================
 *
 * Step 6 has not handled feat-granted spells at all yet (Magic Initiate, Fey
 * Touched, Shadow Touched, Telekinetic, etc.). Feats use the SAME
 * `additionalSpells` field subclasses use (d2b/d6a, D46). This script
 * classifies feats.json's additionalSpells entries into FIXED grants (needs
 * only a derived lookup, like d2b/d6a) vs PLAYER CHOICE grants (needs a
 * picker + storage, like d2) — and reports the choice-encoding shape(s) and
 * whether the data records a spellcasting ability for feat-granted spells —
 * so the feat-spell work (d5) can be sliced. Investigation only, no
 * implementation. Trimmed SUMMARY output only (CLAUDE.md).
 *
 * Run: node scripts/investigate-feat-spells.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

function truncate(obj, len = 250) {
	const s = JSON.stringify(obj);
	return s.length > len ? s.slice(0, len) + "…" : s;
}

function heading(title) {
	console.log("");
	console.log("=".repeat(64));
	console.log(title);
	console.log("=".repeat(64));
}

function containsChoose(node) {
	if (node === null || typeof node !== "object") return false;
	if (Array.isArray(node)) return node.some(containsChoose);
	if (Object.prototype.hasOwnProperty.call(node, "choose")) return true;
	return Object.values(node).some(containsChoose);
}

function findChooseNodes(node, path, out) {
	if (node === null || typeof node !== "object") return;
	if (Array.isArray(node)) {
		node.forEach((v, i) => findChooseNodes(v, path + `[${i}]`, out));
		return;
	}
	if (Object.prototype.hasOwnProperty.call(node, "choose")) out.push({ path, node });
	for (const [k, v] of Object.entries(node)) findChooseNodes(v, path + "." + k, out);
}

const feats = readJson("feats.json");

console.log("SUMMARY");
console.log("total feats:", feats.length);

// --- 1. which feats carry additionalSpells at all ---
heading("1. FEATS WITH additionalSpells");
const withAdditional = feats.filter((f) => Array.isArray(f.additionalSpells) && f.additionalSpells.length > 0);
console.log("count:", withAdditional.length);
for (const f of withAdditional) console.log("  -", f.name, `(${f.source})`);

// --- 2. fixed vs choice split ---
heading("2. FIXED vs PLAYER-CHOICE SPLIT");
const fixedGroup = [];
const choiceGroup = [];
const uncategorized = [];

for (const f of withAdditional) {
	const keys = new Set();
	for (const entry of f.additionalSpells) for (const k of Object.keys(entry)) keys.add(k);
	const hasChoose = f.additionalSpells.some(containsChoose);

	if (hasChoose) {
		choiceGroup.push(f);
	} else if (keys.size > 0) {
		fixedGroup.push(f);
	} else {
		uncategorized.push(f);
	}
}

console.log("fixed grant (derived lookup only, like d2b/d6a):", fixedGroup.length);
for (const f of fixedGroup) console.log("  -", f.name);
console.log("player choice (needs a picker + storage, like d2):", choiceGroup.length);
for (const f of choiceGroup) console.log("  -", f.name);
console.log("uncategorized (fits neither bucket):", uncategorized.length);
for (const f of uncategorized) console.log("  -", f.name, truncate(f.additionalSpells));
console.log(
	"reconciled total:",
	fixedGroup.length + choiceGroup.length + uncategorized.length,
	"(should equal", withAdditional.length + ")",
);

// --- 2a. fixed group: key shapes + trimmed example ---
heading("2a. FIXED GROUP: outer key shapes");
const fixedByShape = new Map();
for (const f of fixedGroup) {
	const keys = new Set();
	for (const entry of f.additionalSpells) for (const k of Object.keys(entry)) keys.add(k);
	const shape = JSON.stringify([...keys].sort());
	if (!fixedByShape.has(shape)) fixedByShape.set(shape, []);
	fixedByShape.get(shape).push(f);
}
for (const [shape, list] of fixedByShape) {
	console.log(" ", list.length, shape);
	const ex = list[0];
	console.log("    e.g.", ex.name, ":", truncate(ex.additionalSpells[0]));
}

// --- 3. choice group: encoding shape of `choose` instructions ---
heading("3. CHOICE GROUP: encoding shapes of `choose` instructions");
const chooseEncodingShapes = new Map();
for (const f of choiceGroup) {
	for (const entry of f.additionalSpells) {
		const found = [];
		findChooseNodes(entry, "additionalSpells[]", found);
		for (const { path: p, node } of found) {
			const chooseVal = node.choose;
			const otherKeys = Object.keys(node).filter((k) => k !== "choose");
			const shape =
				(typeof chooseVal === "string" ? "string" : Array.isArray(chooseVal) ? "array" : typeof chooseVal) +
				" + siblingKeys:" +
				JSON.stringify(otherKeys.sort());
			if (!chooseEncodingShapes.has(shape)) chooseEncodingShapes.set(shape, []);
			if (chooseEncodingShapes.get(shape).length < 3) {
				chooseEncodingShapes.get(shape).push({ name: f.name, path: p, chooseVal });
			}
		}
	}
}
for (const [shape, examples] of chooseEncodingShapes) {
	console.log("\n ", shape);
	for (const ex of examples) console.log("    ", ex.name, "@", ex.path, ":", truncate(ex.chooseVal));
}

console.log("\n--- distinct raw `choose` string values (deduped) ---");
const rawChooseStrings = new Set();
for (const f of choiceGroup) {
	for (const entry of f.additionalSpells) {
		const found = [];
		findChooseNodes(entry, "additionalSpells[]", found);
		for (const { node } of found) {
			if (typeof node.choose === "string") rawChooseStrings.add(node.choose);
		}
	}
}
[...rawChooseStrings].forEach((v) => console.log("  ", v));

// --- 3b. per-feat full additionalSpells shape for choice feats (top-level keys + counts only) ---
heading("3b. CHOICE GROUP: per-feat additionalSpells outer shape");
for (const f of choiceGroup) {
	for (const entry of f.additionalSpells) {
		console.log(" ", f.name, "keys:", Object.keys(entry));
		for (const [k, v] of Object.entries(entry)) {
			if (k === "name") continue;
			console.log("   ", k, ":", truncate(v, 200));
		}
	}
}

// --- 4. non-caster wrinkle: is there a spellcasting ability recorded anywhere for these feats? ---
heading("4. SPELLCASTING ABILITY FOR FEAT-GRANTED SPELLS");
for (const f of withAdditional) {
	const topLevelAbility = f.spellcastingAbility;
	console.log(" ", f.name, "| top-level spellcastingAbility field:", JSON.stringify(topLevelAbility));
}

console.log("\n--- searching additionalSpells entries themselves for an ability-related key ---");
const abilityKeyNames = new Set();
for (const f of withAdditional) {
	for (const entry of f.additionalSpells) {
		for (const k of Object.keys(entry)) {
			if (/abil/i.test(k)) abilityKeyNames.add(k + " (seen on " + f.name + ")");
		}
	}
}
console.log(abilityKeyNames.size === 0 ? "  none found" : [...abilityKeyNames].join("\n  "));

// --- 5. does any feat let the player pick the casting ability or which class list to draw from? ---
heading("5. PLAYER CHOICE OF ABILITY / CLASS LIST");
const magicInitiate = feats.find((f) => /Magic Initiate/i.test(f.name));
if (magicInitiate) {
	console.log("Magic Initiate full additionalSpells:", truncate(magicInitiate.additionalSpells, 500));
} else {
	console.log("Magic Initiate NOT FOUND in feats.json");
}

console.log("\n--- feats with a `choose` node whose filter string references a class placeholder (e.g. #\\$class\\$# or similar) ---");
for (const f of choiceGroup) {
	for (const entry of f.additionalSpells) {
		const found = [];
		findChooseNodes(entry, "additionalSpells[]", found);
		for (const { node } of found) {
			if (typeof node.choose === "string" && /class/i.test(node.choose)) {
				console.log("  ", f.name, ":", node.choose);
			}
		}
	}
}

console.log("\ndone.");
