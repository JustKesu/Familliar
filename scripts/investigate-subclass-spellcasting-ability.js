/*
 * investigate-subclass-spellcasting-ability.js
 * ==============================================
 *
 * One-off investigation: where do Eldritch Knight (Fighter) and Arcane
 * Trickster (Rogue) store `spellcastingAbility`? spellcasting.ts currently
 * only reads it off the base class. Confirms field location/value before
 * mirroring spellSlots.ts's subclass-fallback pattern (D46).
 * Prints a SUMMARY ONLY (per CLAUDE.md).
 *
 * Run: node scripts/investigate-subclass-spellcasting-ability.js
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

heading("Q1. EK/AT spellcastingAbility field, directly on the subclass entry");
{
	const ek = allSubclasses.find((e) => e.name === "Eldritch Knight" && e.className === "Fighter");
	const at = allSubclasses.find((e) => e.name === "Arcane Trickster" && e.className === "Rogue");
	const fighter = baseClasses.find((c) => c.name === "Fighter" && c.source === "XPHB");
	const rogue = baseClasses.find((c) => c.name === "Rogue" && c.source === "XPHB");
	console.log(`Fighter (base) spellcastingAbility: ${JSON.stringify(fighter?.spellcastingAbility)}`);
	console.log(`Rogue (base) spellcastingAbility: ${JSON.stringify(rogue?.spellcastingAbility)}`);
	console.log(`Eldritch Knight (subclass) spellcastingAbility: ${JSON.stringify(ek?.spellcastingAbility)}`);
	console.log(`Arcane Trickster (subclass) spellcastingAbility: ${JSON.stringify(at?.spellcastingAbility)}`);
}

heading("Q2. Every subclass carrying its own spellcastingAbility field");
{
	const withAbility = allSubclasses.filter((sc) => sc.spellcastingAbility != null);
	console.log(`Total subclass entries: ${allSubclasses.length}`);
	console.log(`Subclasses carrying their own spellcastingAbility: ${withAbility.length}`);
	for (const sc of withAbility) {
		console.log(`  ${sc.name} (${sc.className}, ${sc.classSource}) spellcastingAbility=${JSON.stringify(sc.spellcastingAbility)}`);
	}
}

console.log("");
