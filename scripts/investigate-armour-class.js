/*
 * Investigation for build order step 7 slice b (equipped gear + Armour Class).
 * Prints a SUMMARY only. Reads data/items.json, data/class-features.json,
 * data/subclass-features.json, data/classes.json, data/spells.json.
 * Writes nothing.
 *
 * Answers: which alternative AC formulas are DETECTABLE from what the app
 * stores today, and what the armour fields actually hold.
 */
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}
function trunc(v, max) {
	const s = typeof v === "string" ? v : JSON.stringify(v);
	return s == null ? String(s) : s.length > max ? s.slice(0, max - 1) + "…" : s;
}
function typeCode(it) {
	return typeof it.type === "string" ? it.type.split("|")[0] : null;
}
function flatText(node, out) {
	if (typeof node === "string") out.push(node);
	else if (Array.isArray(node)) for (const n of node) flatText(n, out);
	else if (node && typeof node === "object") for (const v of Object.values(node)) flatText(v, out);
	return out;
}
function textOf(entry) {
	return flatText(entry.entries || [], []).join(" ");
}

const items = readJson("items.json");
const classFeatures = readJson("class-features.json");
const subclassFeatures = readJson("subclass-features.json");
const classes = readJson("classes.json");
const spells = readJson("spells.json");

console.log("=".repeat(72));
console.log("Q1  ARMOUR ITEMS — codes, ac, strength, stealth");
console.log("=".repeat(72));
const byCode = (c) => items.filter((it) => typeCode(it) === c);
for (const code of ["LA", "MA", "HA", "S"]) {
	const list = byCode(code);
	const mundane = list.filter((it) => it.rarity === "none");
	const acs = [...new Set(list.map((it) => it.ac))].sort((a, b) => a - b);
	const missingAc = list.filter((it) => typeof it.ac !== "number").length;
	console.log(
		`  ${code}: ${list.length} items (mundane ${mundane.length}, magic ${list.length - mundane.length}); ac values ${JSON.stringify(acs)}; without a numeric ac: ${missingAc}; armor===true on ${list.filter((it) => it.armor === true).length}`,
	);
}
const armourish = items.filter((it) => ["LA", "MA", "HA"].includes(typeCode(it)));
console.log(`  strength non-null values across LA/MA/HA: ${JSON.stringify([...new Set(armourish.filter((it) => it.strength != null).map((it) => it.strength))])}`);
console.log(`  which codes carry strength: ${JSON.stringify([...new Set(armourish.filter((it) => it.strength != null).map((it) => typeCode(it)))])}`);
console.log(`  stealth===true count: ${armourish.filter((it) => it.stealth === true).length}; by code: ${JSON.stringify([...new Set(armourish.filter((it) => it.stealth === true).map((it) => typeCode(it)))])}`);
console.log("  examples (exact name | source | code | ac | strength | stealth | rarity):");
for (const nm of ["Chain Mail", "Leather Armor", "Half Plate Armor", "Shield", "Plate Armor", "Studded Leather Armor"]) {
	const it = items.find((x) => x.name === nm);
	console.log(it ? `    ${nm.padEnd(24)} ${it.source.padEnd(5)} ${String(typeCode(it)).padEnd(3)} ac=${JSON.stringify(it.ac)} str=${JSON.stringify(it.strength)} stealth=${JSON.stringify(it.stealth)} rarity=${it.rarity}` : `    ${nm}: NOT FOUND`);
}
const magicArmourExamples = armourish.filter((it) => it.rarity !== "none").slice(0, 3);
console.log(`  magic armour examples: ${magicArmourExamples.map((it) => `${it.name}|${it.source} (${typeCode(it)}, ac=${JSON.stringify(it.ac)}, bonusAc=${JSON.stringify(it.bonusAc)})`).join("; ")}`);
const magicShields = byCode("S").filter((it) => it.rarity !== "none");
console.log(`  magic shields: ${magicShields.length}; examples: ${magicShields.slice(0, 3).map((it) => `${it.name} (ac=${JSON.stringify(it.ac)}, bonusAc=${JSON.stringify(it.bonusAc)})`).join("; ")}`);

console.log("\n" + "=".repeat(72));
console.log("Q2  UNARMORED DEFENSE — class-features.json");
console.log("=".repeat(72));
const ud = classFeatures.filter((f) => /unarmored defense/i.test(f.name || ""));
console.log(`  entries named "Unarmored Defense": ${ud.length}`);
for (const f of ud) {
	console.log(`    ${f.name} | class=${f.className}/${f.classSource} | level=${f.level} | source=${f.source}`);
	console.log(`      text: ${trunc(textOf(f), 180)}`);
}
const acFeatures = classFeatures.filter((f) => /Armor Class equals|Armor Class is equal/i.test(textOf(f)));
console.log(`  class features whose text sets an Armor Class formula: ${acFeatures.length} -> ${acFeatures.map((f) => `${f.name} (${f.className} ${f.level})`).join(", ")}`);

console.log("\n" + "=".repeat(72));
console.log("Q3  SUBCLASS FEATURES SETTING AN AC FORMULA — subclass-features.json");
console.log("=".repeat(72));
const scAc = subclassFeatures.filter((f) => /\b(AC|Armor Class)\b[^.]{0,40}\b(equals|is equal|becomes)\b/i.test(textOf(f)));
console.log(`  subclass features setting an AC formula: ${scAc.length}`);
for (const f of scAc.slice(0, 8)) {
	console.log(`    ${f.name} | ${f.className}/${f.classSource} | subclass=${f.subclassShortName}/${f.subclassSource} | level=${f.level}`);
	console.log(`      text: ${trunc(textOf(f), 200)}`);
}
const draconicFeatures = subclassFeatures.filter((f) => f.subclassShortName === "Draconic" && f.className === "Sorcerer");
console.log(`  Sorcerer/Draconic subclass features: ${draconicFeatures.length} -> ${draconicFeatures.map((f) => `${f.name}@${f.level}/${f.subclassSource}`).join(", ")}`);
for (const f of draconicFeatures.filter((f) => /\bAC\b|Armor Class/i.test(textOf(f)))) {
	console.log(`    ${f.name} (${f.subclassSource}, level ${f.level}): ${trunc(textOf(f), 220)}`);
}

console.log("\n" + "=".repeat(72));
console.log("Q4  DRACONIC SORCERER — how the subclass is NAMED (storage keeps the name only)");
console.log("=".repeat(72));
const draconicSubclasses = classes.filter((c) => c.entryType === "subclass" && /draconic/i.test(c.name || ""));
for (const c of draconicSubclasses) {
	console.log(`    subclass entry: name="${c.name}" shortName="${c.shortName}" source=${c.source} class=${c.className}/${c.classSource}`);
}
const monkClasses = classes.filter((c) => c.entryType === "class" && ["Monk", "Barbarian", "Sorcerer"].includes(c.name));
console.log(`    base class entries: ${monkClasses.map((c) => `${c.name}/${c.source}`).join(", ")}`);

console.log("\n" + "=".repeat(72));
console.log("Q5  MAGE ARMOR — spells.json");
console.log("=".repeat(72));
const mageArmor = spells.filter((s) => /^mage armor$/i.test(s.name || ""));
console.log(`  entries named "Mage Armor": ${mageArmor.length}`);
for (const s of mageArmor) {
	console.log(`    ${s.name}|${s.source} level=${s.level} duration=${trunc(s.duration, 80)}`);
	console.log(`      availableTo.classes: ${trunc((s.availableTo && s.availableTo.classes) || [], 120)}`);
	console.log(`      text: ${trunc(textOf(s), 160)}`);
}

console.log("\n" + "=".repeat(72));
console.log("done");
