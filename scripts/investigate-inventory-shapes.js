/*
 * Investigation for build order step 7 (Inventory and equipment). Prints a
 * SUMMARY only — counts and at most 3 short examples per point. Reads
 * data/classes.json, data/backgrounds.json, data/items.json. Writes nothing.
 *
 * Answers six questions: starting equipment (classes + backgrounds), armour
 * fields, weapon fields, everything-else item kinds, attunement + cost.
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
function hist(pairs) {
	const m = new Map();
	for (const k of pairs) m.set(k, (m.get(k) || 0) + 1);
	return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function printHist(title, pairs, limit = 40) {
	console.log(`  ${title}`);
	const h = hist(pairs);
	for (const [k, n] of h.slice(0, limit)) console.log(`    ${String(k).padEnd(34)} ${n}`);
	if (h.length > limit) console.log(`    ...(${h.length - limit} more)`);
}
function typeCode(it) {
	return typeof it.type === "string" ? it.type.split("|")[0] : null;
}

const classes = readJson("classes.json");
const backgrounds = readJson("backgrounds.json");
const items = readJson("items.json");

console.log("=".repeat(72));
console.log("Q1a  STARTING EQUIPMENT — classes.json");
console.log("=".repeat(72));
const baseClasses = classes.filter((c) => c.entryType === "class");
console.log(`Base classes: ${baseClasses.length}`);
let clsWithSE = 0;
const seKeyCounts = [];
const shapeOfDefault = [];
const shapeOfGold = [];
let defaultDataPresent = 0;
let proseOnly = 0;
const clsExamples = [];
for (const c of baseClasses) {
	const se = c.startingEquipment;
	if (!se || typeof se !== "object") {
		clsExamples.push(`${c.name}: NO startingEquipment field`);
		continue;
	}
	clsWithSE++;
	for (const k of Object.keys(se)) seKeyCounts.push(k);
	if (Array.isArray(se.default)) {
		const allStr = se.default.every((x) => typeof x === "string");
		shapeOfDefault.push(allStr ? "default: array of strings (prose)" : "default: array (mixed/other)");
	} else if (se.default !== undefined) {
		shapeOfDefault.push(`default: ${typeof se.default}`);
	}
	if (se.defaultData !== undefined) {
		defaultDataPresent++;
		if (Array.isArray(se.defaultData) && se.defaultData.length) {
			const keys = se.defaultData.flatMap((row) => (row && typeof row === "object" ? Object.keys(row) : [typeof row]));
			shapeOfDefault.push(`defaultData rows keyed: {${[...new Set(keys)].join(",")}}`);
		}
	} else if (Array.isArray(se.default)) {
		proseOnly++;
	}
	if (se.goldAlternative !== undefined) shapeOfGold.push(`goldAlternative: ${typeof se.goldAlternative}`);
	if (se.wealth !== undefined) shapeOfGold.push(`wealth: ${typeof se.wealth}`);
	if (clsExamples.length < 3) {
		clsExamples.push(
			`${c.name}: keys={${Object.keys(se).join(",")}} ` +
				`goldAlt=${trunc(se.goldAlternative, 40)} ` +
				`default[0]=${trunc(Array.isArray(se.default) ? se.default[0] : undefined, 70)}`,
		);
	}
}
console.log(`Classes with a startingEquipment field: ${clsWithSE}/${baseClasses.length}`);
printHist("startingEquipment sub-keys (count = classes carrying it):", seKeyCounts);
printHist("shape of package field:", shapeOfDefault);
printHist("shape of gold alternative:", shapeOfGold);
console.log(`  classes with a STRUCTURED package (defaultData): ${defaultDataPresent}`);
console.log(`  classes whose package is PROSE ONLY (default strings, no defaultData): ${proseOnly}`);
console.log("  examples:");
for (const e of clsExamples) console.log(`    ${e}`);
// defaultData row values + the entries prose (the gold alternative lives in prose)
const ddElemShapes = [];
let goldInProse = 0;
for (const c of baseClasses) {
	const se = c.startingEquipment;
	if (!se || !Array.isArray(se.defaultData)) continue;
	for (const row of se.defaultData) {
		if (!row || typeof row !== "object") continue;
		for (const arr of Object.values(row)) {
			if (!Array.isArray(arr)) { ddElemShapes.push(typeof arr); continue; }
			for (const el of arr) ddElemShapes.push(typeof el === "string" ? "string(item-code)" : el && typeof el === "object" ? `{${Object.keys(el).join(",")}}` : typeof el);
		}
	}
	const proseText = (se.entries || []).map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join(" ");
	if (/\bGP\b|gold|{@dice/i.test(proseText)) goldInProse++;
}
printHist("defaultData option-array element shapes:", ddElemShapes);
console.log(`  classes whose gold alternative is ONLY in the entries prose string (no numeric field): ${goldInProse}/13`);
for (const nm of ["Fighter", "Wizard", "Monk"]) {
	const c = baseClasses.find((x) => x.name === nm);
	if (!c || !c.startingEquipment) continue;
	const se = c.startingEquipment;
	console.log(`    ${nm}: defaultData=${trunc(JSON.stringify(se.defaultData), 200)}`);
	console.log(`    ${nm}: entries=${trunc((se.entries || []).join(" "), 200)}`);
}

console.log("\n" + "=".repeat(72));
console.log("Q1b  STARTING EQUIPMENT — backgrounds.json");
console.log("=".repeat(72));
console.log(`Backgrounds: ${backgrounds.length}`);
let bgArrLen1 = 0;
let bgHasTwoOptions = 0;
const bgOptionKeys = [];
const elemShapes = [];
let coinInA = 0;
let coinInB = 0;
const coinValues = [];
const equipmentTypeVals = [];
let bgProseOnly = 0;
const bgExamples = [];
function classifyElem(el) {
	if (typeof el === "string") return "bare item-code string";
	if (el && typeof el === "object") {
		if ("value" in el) return "{value:<coins>}";
		if ("item" in el) return "{item, displayName?, quantity?}";
		if ("equipmentType" in el) return "{equipmentType}";
		if ("special" in el) return "{special}";
		return `{${Object.keys(el).join(",")}}`;
	}
	return typeof el;
}
for (const bg of backgrounds) {
	const se = bg.startingEquipment;
	if (!Array.isArray(se)) {
		bgProseOnly++;
		continue;
	}
	if (se.length === 1) bgArrLen1++;
	const obj = se[0] && typeof se[0] === "object" ? se[0] : {};
	const keys = Object.keys(obj);
	for (const k of keys) bgOptionKeys.push(k);
	const lower = {};
	for (const k of keys) lower[k.toLowerCase()] = obj[k];
	if ("a" in lower && "b" in lower) bgHasTwoOptions++;
	for (const [k, arr] of Object.entries(lower)) {
		if (!Array.isArray(arr)) continue;
		for (const el of arr) {
			elemShapes.push(classifyElem(el));
			if (el && typeof el === "object" && "value" in el) {
				coinValues.push(el.value);
				if (k === "a") coinInA++;
				if (k === "b") coinInB++;
			}
			if (el && typeof el === "object" && "equipmentType" in el) equipmentTypeVals.push(el.equipmentType);
		}
	}
	if (bgExamples.length < 3) {
		bgExamples.push(`${bg.name} (${bg.source}): optionKeys={${keys.join(",")}}`);
	}
}
console.log(`startingEquipment is a 1-element array: ${bgArrLen1}/${backgrounds.length}`);
console.log(`backgrounds offering BOTH an A/a and B/b option: ${bgHasTwoOptions}/${backgrounds.length}`);
console.log(`backgrounds expressing equipment only as prose (no structured array): ${bgProseOnly}`);
printHist("option keys seen (case as stored):", bgOptionKeys);
printHist("element shapes across all option arrays:", elemShapes);
console.log(`  coin {value} element appears in option A/a: ${coinInA} background(s); in option B/b: ${coinInB}`);
console.log(`  distinct coin {value} amounts (raw): ${[...new Set(coinValues)].sort((a, b) => a - b).join(", ")}`);
console.log(`  {equipmentType} values seen: ${[...new Set(equipmentTypeVals)].join(", ")}`);
console.log(`  coin value type: ${[...new Set(coinValues.map((v) => typeof v))].join(",")} (5etools stores coin value in COPPER)`);
console.log("  examples:");
for (const e of bgExamples) console.log(`    ${e}`);

console.log("\n" + "=".repeat(72));
console.log("Q2  ARMOUR — items.json");
console.log("=".repeat(72));
const armour = items.filter((it) => it.armor === true);
const shields = items.filter((it) => typeCode(it) === "S");
const armourCodes = new Set(["LA", "MA", "HA"]);
const armourByCode = items.filter((it) => armourCodes.has(typeCode(it)));
console.log(`items with armor===true: ${armour.length}`);
console.log(`items with an armour type code LA/MA/HA: ${armourByCode.length}; of those, armor===true: ${armourByCode.filter((it) => it.armor === true).length}, armor flag ABSENT: ${armourByCode.filter((it) => it.armor !== true).length} (of those rarity!==none: ${armourByCode.filter((it) => it.armor !== true && it.rarity !== "none").length})`);
console.log(`items with type code "S" (shields; NO armor flag per DATA.md): ${shields.length}, of which armor===true: ${shields.filter((s) => s.armor === true).length}`);
printHist("armour `type` code -> count:", armour.map((it) => `${typeCode(it)} (${trunc(it.typeFull, 22)})`));
console.log(`  ac present: ${armour.filter((it) => typeof it.ac === "number").length}/${armour.length}; ac values range ${Math.min(...armour.map((it) => it.ac))}..${Math.max(...armour.map((it) => it.ac))}`);
printHist("armour `strength` field typeof:", armour.map((it) => (it.strength === null ? "null" : typeof it.strength)));
console.log(`  strength non-null values seen: ${[...new Set(armour.filter((it) => it.strength != null).map((it) => it.strength))].join(", ")}`);
console.log(`  stealth===true (disadvantage): ${armour.filter((it) => it.stealth === true).length}; other stealth values: ${[...new Set(armour.filter((it) => it.stealth !== true).map((it) => JSON.stringify(it.stealth)))].join(", ")}`);
const armourKeys = [...new Set(armour.flatMap((it) => Object.keys(it)))].sort();
console.log(`  ALL keys present on any armour item:\n    ${armourKeys.join(", ")}`);
console.log(`  keys matching /dex|max/i (Dex-cap candidates): ${armourKeys.filter((k) => /dex|max/i.test(k)).join(", ") || "(none)"}`);
const shieldKeys = [...new Set(shields.flatMap((it) => Object.keys(it)))].sort();
console.log(`  shield: ac values ${[...new Set(shields.map((s) => s.ac))].join(",")}; all shield keys: ${shieldKeys.join(", ")}`);
console.log("  examples (name | type | ac | strength | stealth):");
for (const nm of ["Padded Armor", "Leather Armor", "Hide Armor", "Chain Shirt", "Half Plate Armor", "Plate Armor", "Shield"]) {
	const it = items.find((x) => x.name === nm);
	if (it) console.log(`    ${nm.padEnd(18)} ${String(typeCode(it)).padEnd(4)} ac=${JSON.stringify(it.ac)} str=${JSON.stringify(it.strength)} stealth=${JSON.stringify(it.stealth)}`);
}

console.log("\n" + "=".repeat(72));
console.log("Q3  WEAPONS — items.json");
console.log("=".repeat(72));
const weapons = items.filter((it) => it.weapon === true);
const weaponCodes = new Set(["M", "R", "GUN"]);
const weaponsByCode = items.filter((it) => weaponCodes.has(typeCode(it)));
console.log(`items with weapon===true: ${weapons.length}`);
console.log(`items with a 2014 weapon type code M/R/GUN: ${weaponsByCode.length}; of those weapon===true: ${weaponsByCode.filter((it) => it.weapon === true).length}, weapon flag ABSENT: ${weaponsByCode.filter((it) => it.weapon !== true).length} (of those rarity!==none: ${weaponsByCode.filter((it) => it.weapon !== true && it.rarity !== "none").length}) -- DATA.md "Identifying item kinds" says weapons have a boolean flag; magic weapons typed by 2014 code do not`);
printHist("weaponCategory (already plain words, D34):", weapons.map((it) => JSON.stringify(it.weaponCategory)));
console.log(`  dmg1 present: ${weapons.filter((it) => it.dmg1 !== undefined).length}; sample: ${[...new Set(weapons.map((it) => it.dmg1))].slice(0, 8).join(", ")}`);
console.log(`  dmg2 present (versatile two-handed die, separate field): ${weapons.filter((it) => it.dmg2 !== undefined).length}; sample: ${[...new Set(weapons.filter((it) => it.dmg2).map((it) => it.dmg2))].slice(0, 8).join(", ")}`);
printHist("dmgType raw code:", weapons.map((it) => JSON.stringify(it.dmgType)));
console.log(`  dmgTypeFull present (resolved, D34): ${weapons.filter((it) => it.dmgTypeFull !== undefined).length}`);
console.log(`  property (raw code array) present: ${weapons.filter((it) => Array.isArray(it.property)).length}; propertyFull (resolved) present: ${weapons.filter((it) => Array.isArray(it.propertyFull)).length}`);
printHist("propertyFull values across all weapons:", weapons.flatMap((it) => it.propertyFull || []));
console.log(`  raw property code sample: ${JSON.stringify((weapons.find((it) => Array.isArray(it.property)) || {}).property)}`);
console.log(`  mastery raw present: ${weapons.filter((it) => Array.isArray(it.mastery)).length}; masteryFull present: ${weapons.filter((it) => Array.isArray(it.masteryFull)).length}`);
printHist("masteryFull values:", weapons.flatMap((it) => it.masteryFull || []));
console.log(`  range field present: ${weapons.filter((it) => it.range !== undefined).length}; typeof: ${[...new Set(weapons.filter((it) => it.range !== undefined).map((it) => typeof it.range))].join(",")}; sample: ${[...new Set(weapons.filter((it) => it.range !== undefined).map((it) => it.range))].slice(0, 8).join(", ")}`);
const hasProp = (it, code, word) => (it.property || []).some((p) => String(p).split("|")[0] === code) || (it.propertyFull || []).includes(word);
console.log(`  weapons carrying versatile: ${weapons.filter((it) => hasProp(it, "V", "Versatile")).length} (dmg2 count above should match)`);
console.log(`  weapons carrying finesse:   ${weapons.filter((it) => hasProp(it, "F", "Finesse")).length}`);
console.log(`  weapons carrying thrown:    ${weapons.filter((it) => hasProp(it, "T", "Thrown")).length}`);
console.log(`  weapons carrying ammunition:${weapons.filter((it) => hasProp(it, "A", "Ammunition")).length}`);
const weaponKeys = [...new Set(weapons.flatMap((it) => Object.keys(it)))].sort();
console.log(`  ALL keys present on any weapon item:\n    ${weaponKeys.join(", ")}`);
console.log("  examples (name | cat | dmg1 | dmg2 | dmgType/full | propertyFull | masteryFull | range):");
for (const nm of ["Dagger", "Shortsword", "Longsword", "Quarterstaff", "Shortbow", "Longbow", "Net"]) {
	const it = items.find((x) => x.name === nm && x.weapon === true);
	if (it) console.log(`    ${nm.padEnd(12)} ${String(it.weaponCategory).padEnd(7)} ${String(it.dmg1).padEnd(5)} ${String(it.dmg2 || "-").padEnd(5)} ${String(it.dmgType || "-")}/${String((it.dmgTypeFull || "-")).padEnd(11)} [${(it.propertyFull || []).join(",")}] [${(it.masteryFull || []).join(",")}] range=${JSON.stringify(it.range)}`);
}

console.log("\n" + "=".repeat(72));
console.log("Q4  EVERYTHING ELSE — items.json (non-weapon, non-armour, non-shield)");
console.log("=".repeat(72));
const other = items.filter((it) => it.weapon !== true && it.armor !== true && typeCode(it) !== "S");
console.log(`other items: ${other.length}  (total items.json: ${items.length}; weapons ${weapons.length}; armour ${armour.length}; shields ${shields.length})`);
printHist("`type` code -> (typeFull) -> count  [broad kind breakdown]:", other.map((it) => `${typeCode(it) === null ? "(no type)" : typeCode(it)} (${trunc(it.typeFull, 26)})`), 60);
console.log(`  items with containerCapacity (DATA.md: how a container is identified): ${items.filter((it) => it.containerCapacity !== undefined).length}`);
console.log(`    examples: ${items.filter((it) => it.containerCapacity !== undefined).slice(0, 3).map((it) => it.name).join(", ")}`);
const packs = items.filter((it) => Array.isArray(it.packContents));
console.log(`  items with packContents (a pack listing its contents structurally): ${packs.length}`);
for (const p of packs.slice(0, 15)) {
	const shapes = [...new Set(p.packContents.map((e) => (typeof e === "string" ? "string" : e && typeof e === "object" ? `{${Object.keys(e).join(",")}}` : typeof e)))];
	console.log(`    ${p.name.padEnd(22)} ${p.packContents.length} entries; element shapes: ${shapes.join(" | ")}`);
}
const burglar = items.find((it) => /burglar/i.test(it.name || ""));
if (burglar) console.log(`    Burglar's Pack packContents sample element: ${trunc(JSON.stringify(burglar.packContents && burglar.packContents[0]), 120)}`);
console.log(`  ammunition: type code "A" items: ${items.filter((it) => typeCode(it) === "A").length}; items with ammoType field: ${items.filter((it) => it.ammoType !== undefined).length}`);
console.log(`  tools: AT(artisan)=${items.filter((it) => typeCode(it) === "AT").length} T(tools)=${items.filter((it) => typeCode(it) === "T").length} GS(gaming set)=${items.filter((it) => typeCode(it) === "GS").length} INS(instrument)=${items.filter((it) => typeCode(it) === "INS").length}`);
console.log(`  consumables: P(potion)=${items.filter((it) => typeCode(it) === "P").length} SC(scroll)=${items.filter((it) => typeCode(it) === "SC").length} FD(food)=${items.filter((it) => typeCode(it) === "FD").length}`);
console.log(`  magic vs mundane (D34/D46, rarity test): rarity==="none": ${items.filter((it) => it.rarity === "none").length}; rarity!=="none": ${items.filter((it) => it.rarity !== "none").length}`);

console.log("\n" + "=".repeat(72));
console.log("Q5  ATTUNEMENT AND COST — items.json");
console.log("=".repeat(72));
const attune = items.filter((it) => it.reqAttune !== undefined);
console.log(`items with reqAttune: ${attune.length}`);
printHist("reqAttune value typeof:", attune.map((it) => typeof it.reqAttune));
console.log(`  reqAttune===true (boolean): ${attune.filter((it) => it.reqAttune === true).length}`);
const attuneStrings = [...new Set(attune.filter((it) => typeof it.reqAttune === "string").map((it) => it.reqAttune))];
console.log(`  distinct reqAttune STRING values: ${attuneStrings.length}; examples:`);
for (const s of attuneStrings.slice(0, 3)) console.log(`    "${trunc(s, 90)}"`);
console.log(`  items with reqAttuneTags: ${items.filter((it) => it.reqAttuneTags !== undefined).length}`);
const valued = items.filter((it) => it.value !== undefined);
console.log(`  items with value (cost): ${valued.length}/${items.length}`);
printHist("value typeof:", valued.map((it) => typeof it.value));
console.log(`  value range: ${Math.min(...valued.map((it) => it.value))}..${Math.max(...valued.map((it) => it.value))} (5etools unit = COPPER; gp = value/100)`);
console.log(`  items with a currency-unit field (valueMult/currencyConversion/coinValue): ${items.filter((it) => it.valueMult !== undefined || it.currencyConversion !== undefined).length}`);
for (const nm of ["Dagger", "Longsword", "Plate Armor", "Potion of Healing"]) {
	const it = items.find((x) => x.name === nm);
	if (it) console.log(`    ${nm.padEnd(18)} value=${JSON.stringify(it.value)}  (= ${it.value != null ? it.value / 100 + " gp" : "n/a"})`);
}
printHist("rarity histogram (whole file):", items.map((it) => JSON.stringify(it.rarity)));

console.log("\n" + "=".repeat(72));
console.log("done");
