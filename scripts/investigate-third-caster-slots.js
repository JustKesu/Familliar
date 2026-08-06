/*
 * investigate-third-caster-slots.js
 * ==================================
 *
 * One-off investigation for D46: where do Eldritch Knight (Fighter) and
 * Arcane Trickster (Rogue) — the two third-caster subclasses — store their
 * spell-slot table? Slice (d1) found spellSlots.ts's current read path
 * (base class classTableGroups/rowsSpellProgression) comes up empty for
 * them. This confirms the actual location and shape before any fix.
 * Prints a SUMMARY ONLY (per CLAUDE.md) — never whole entries or files.
 *
 * Run: node scripts/investigate-third-caster-slots.js
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

const classes = readJson("classes.json");
const allSubclasses = classes.filter((e) => e.entryType === "subclass");
const baseClasses = classes.filter((e) => e.entryType === "class");

heading("Q1. Locate Eldritch Knight / Arcane Trickster — file + identifying fields");
{
	const ek = allSubclasses.find((e) => e.name === "Eldritch Knight" && e.className === "Fighter");
	const at = allSubclasses.find((e) => e.name === "Arcane Trickster" && e.className === "Rogue");
	console.log("File: data/classes.json (entryType === 'subclass')");
	for (const sc of [ek, at]) {
		if (!sc) {
			console.log("  NOT FOUND");
			continue;
		}
		console.log(
			`  name=${sc.name} className=${sc.className} classSource=${sc.classSource} source=${sc.source} shortName=${sc.shortName}`,
		);
	}
}

heading("Q2/Q3. Where is the slot table, and is its shape identical to the base-class shape?");
{
	function baseSlotGroup(entry) {
		return entry.classTableGroups?.find((g) => g.rowsSpellProgression);
	}
	function subSlotGroup(entry) {
		return entry.subclassTableGroups?.find((g) => g.rowsSpellProgression);
	}

	const fighter = baseClasses.find((c) => c.name === "Fighter" && c.source === "XPHB");
	const rogue = baseClasses.find((c) => c.name === "Rogue" && c.source === "XPHB");
	console.log(`Fighter (base) classTableGroups with rowsSpellProgression: ${!!baseSlotGroup(fighter)}`);
	console.log(`Rogue (base) classTableGroups with rowsSpellProgression: ${!!baseSlotGroup(rogue)}`);

	const ek = allSubclasses.find((e) => e.name === "Eldritch Knight" && e.className === "Fighter");
	const at = allSubclasses.find((e) => e.name === "Arcane Trickster" && e.className === "Rogue");

	for (const sc of [ek, at]) {
		if (!sc) continue;
		console.log(`\n  ${sc.name} top-level keys: ${Object.keys(sc).join(", ")}`);
		console.log(`  ${sc.name} classTableGroups with rowsSpellProgression: ${!!baseSlotGroup(sc)}`);
		const group = subSlotGroup(sc);
		console.log(`  ${sc.name} subclassTableGroups with rowsSpellProgression: ${!!group}`);
		if (group) {
			console.log(`  ${sc.name} matched group keys: ${Object.keys(group).join(", ")}`);
			console.log(`  ${sc.name} colLabels: ${JSON.stringify(group.colLabels)}`);
			console.log(`  ${sc.name} rowsSpellProgression length: ${group.rowsSpellProgression.length}`);
		} else if (sc.subclassTableGroups) {
			console.log(`  ${sc.name} subclassTableGroups present but no rowsSpellProgression group. Group shapes:`);
			for (const g of sc.subclassTableGroups) {
				console.log(`    keys=${Object.keys(g).join(", ")} title=${JSON.stringify(g.title)}`);
			}
		} else {
			console.log(`  ${sc.name} has no subclassTableGroups at all.`);
		}
	}
}

heading("Q4. casterProgression on the subclass entry");
{
	const ek = allSubclasses.find((e) => e.name === "Eldritch Knight" && e.className === "Fighter");
	const at = allSubclasses.find((e) => e.name === "Arcane Trickster" && e.className === "Rogue");
	const fighter = baseClasses.find((c) => c.name === "Fighter" && c.source === "XPHB");
	const rogue = baseClasses.find((c) => c.name === "Rogue" && c.source === "XPHB");
	console.log(`Fighter (base) casterProgression: ${JSON.stringify(fighter?.casterProgression)}`);
	console.log(`Rogue (base) casterProgression: ${JSON.stringify(rogue?.casterProgression)}`);
	console.log(`Eldritch Knight (subclass) casterProgression: ${JSON.stringify(ek?.casterProgression)}`);
	console.log(`Arcane Trickster (subclass) casterProgression: ${JSON.stringify(at?.casterProgression)}`);
}

heading("Q5. How many subclasses total carry a spell-slot table (any location)?");
{
	function anySlotGroup(sc) {
		return (
			sc.classTableGroups?.find((g) => g.rowsSpellProgression) ||
			sc.subclassTableGroups?.find((g) => g.rowsSpellProgression)
		);
	}
	const withOwnTable = allSubclasses.filter((sc) => anySlotGroup(sc));
	console.log(`Total subclass entries: ${allSubclasses.length}`);
	console.log(`Subclasses carrying their own spell-slot table: ${withOwnTable.length}`);
	for (const sc of withOwnTable) {
		const loc = sc.classTableGroups?.find((g) => g.rowsSpellProgression) ? "classTableGroups" : "subclassTableGroups";
		console.log(`  ${sc.name} (${sc.className}, ${sc.source}) casterProgression=${JSON.stringify(sc.casterProgression)} in ${loc}`);
	}

	console.log(`\nAll subclasses with a non-null casterProgression (regardless of table location):`);
	const withProgression = allSubclasses.filter((sc) => sc.casterProgression != null);
	console.log(`  count: ${withProgression.length}`);
	for (const sc of withProgression) {
		console.log(`  ${sc.name} (${sc.className}, ${sc.source}) casterProgression=${JSON.stringify(sc.casterProgression)}`);
	}
}

heading("Q6. Trimmed example — Eldritch Knight slot table, level 3 (index 2) and level 13 (index 12)");
{
	const ek = allSubclasses.find((e) => e.name === "Eldritch Knight" && e.className === "Fighter");
	const group = ek?.subclassTableGroups?.find((g) => g.rowsSpellProgression);
	if (group) {
		console.log(`colLabels: ${JSON.stringify(group.colLabels)}`);
		console.log(`row index 2 (level 3): ${JSON.stringify(group.rowsSpellProgression[2])}`);
		console.log(`row index 12 (level 13): ${JSON.stringify(group.rowsSpellProgression[12])}`);
	} else {
		console.log("No rowsSpellProgression group found for Eldritch Knight in subclassTableGroups.");
		if (ek?.subclassTableGroups) {
			for (const g of ek.subclassTableGroups) {
				console.log(`  group title=${JSON.stringify(g.title)} keys=${Object.keys(g).join(", ")}`);
			}
		}
	}
}

console.log("");
