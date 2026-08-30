/*
 * Investigation for build order step 7, slice a2 (starting equipment). Prints a
 * SUMMARY only — counts, key histograms and at most 3 short examples per point.
 * Reads data/classes.json, data/backgrounds.json, data/items.json. Writes nothing.
 *
 * Answers what slice a2 has to consume: the exact option-row keys, every element
 * shape inside an option, the vocabulary of the category elements, whether the
 * `item` code strings resolve against items.json, and how packContents is shaped.
 */
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");

/*
 * Sections are individually selectable (`node scripts/investigate-starting-equipment.js F`)
 * so a follow-up question costs one section of output, not the whole survey.
 */
const ONLY = (process.argv[2] || "").toUpperCase();
const realLog = console.log;
function section(name) {
	console.log = !ONLY || ONLY === name ? realLog : () => {};
}

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}
function hist(values) {
	const m = new Map();
	for (const v of values) m.set(v, (m.get(v) || 0) + 1);
	return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function printHist(title, values, limit = 30) {
	console.log(`  ${title}`);
	const h = hist(values);
	for (const [k, n] of h.slice(0, limit)) console.log(`    ${String(k).padEnd(46)} ${n}`);
	if (h.length > limit) console.log(`    ...(${h.length - limit} more)`);
}

const classes = readJson("classes.json").filter((c) => c.entryType === "class");
const backgrounds = readJson("backgrounds.json");
const items = readJson("items.json");

const itemKeys = new Set(items.map((it) => `${String(it.name).toLowerCase()}|${String(it.source).toLowerCase()}`));
const itemsByLowerName = new Map();
for (const it of items) {
	const k = String(it.name).toLowerCase();
	if (!itemsByLowerName.has(k)) itemsByLowerName.set(k, []);
	itemsByLowerName.get(k).push(it);
}

const rowKeys = [];
const elemShapes = [];
const equipTypeValues = [];
const specialValues = [];
const quantityTypes = [];
const valueAmounts = [];
const itemCodes = [];
let optionCounts = [];

function walkOption(arr) {
	for (const el of arr) {
		if (typeof el === "string") {
			elemShapes.push("bare string");
			itemCodes.push(el);
			continue;
		}
		if (!el || typeof el !== "object") {
			elemShapes.push(typeof el);
			continue;
		}
		elemShapes.push(`{${Object.keys(el).sort().join(",")}}`);
		if (typeof el.item === "string") itemCodes.push(el.item);
		if (el.quantity !== undefined) quantityTypes.push(typeof el.quantity);
		if (el.value !== undefined) valueAmounts.push(el.value);
		if (el.equipmentType !== undefined) equipTypeValues.push(String(el.equipmentType));
		if (el.equipmentTypes !== undefined) equipTypeValues.push(`[]${JSON.stringify(el.equipmentTypes)}`);
		if (el.special !== undefined) specialValues.push(String(el.special));
	}
}

section("A");
console.log("=".repeat(70));
console.log("A  CLASSES — startingEquipment.defaultData");
console.log("=".repeat(70));
for (const c of classes) {
	const dd = c.startingEquipment && c.startingEquipment.defaultData;
	if (!Array.isArray(dd)) {
		console.log(`  !! ${c.name}: no defaultData array`);
		continue;
	}
	optionCounts.push(dd.length);
	for (const row of dd) {
		if (!row || typeof row !== "object") continue;
		for (const k of Object.keys(row)) rowKeys.push(k);
		for (const arr of Object.values(row)) if (Array.isArray(arr)) walkOption(arr);
	}
}
printHist("defaultData row count per class (how many option rows):", optionCounts);
printHist("row keys:", rowKeys);
printHist("element shapes:", elemShapes);
printHist("quantity typeof:", quantityTypes);
console.log(`  {value} amounts seen: ${[...new Set(valueAmounts)].sort((a, b) => a - b).join(", ")}`);
printHist("equipmentType / equipmentTypes values:", equipTypeValues);
printHist("special values:", specialValues);
console.log("  full example — Bard defaultData:");
console.log(`    ${JSON.stringify((classes.find((c) => c.name === "Bard") || {}).startingEquipment?.defaultData)}`);

section("B");
console.log("\n" + "=".repeat(70));
console.log("B  BACKGROUNDS — startingEquipment");
console.log("=".repeat(70));
const bgRowKeys = [];
const bgElemShapes = [];
const bgOptionSizes = [];
elemShapes.length = 0;
equipTypeValues.length = 0;
specialValues.length = 0;
quantityTypes.length = 0;
valueAmounts.length = 0;
for (const bg of backgrounds) {
	const se = bg.startingEquipment;
	if (!Array.isArray(se)) {
		console.log(`  !! ${bg.name}: startingEquipment is not an array`);
		continue;
	}
	bgOptionSizes.push(se.length);
	for (const row of se) {
		if (!row || typeof row !== "object") continue;
		for (const k of Object.keys(row)) bgRowKeys.push(k);
		for (const arr of Object.values(row)) if (Array.isArray(arr)) walkOption(arr);
	}
}
printHist("startingEquipment array length:", bgOptionSizes);
printHist("row keys:", bgRowKeys);
printHist("element shapes:", elemShapes);
printHist("quantity typeof:", quantityTypes);
console.log(`  {value} amounts seen: ${[...new Set(valueAmounts)].sort((a, b) => a - b).join(", ")}`);
printHist("equipmentType / equipmentTypes values:", equipTypeValues);
printHist("special values:", specialValues);
console.log("  full example — Acolyte startingEquipment:");
console.log(`    ${JSON.stringify((backgrounds.find((b) => b.name === "Acolyte") || {}).startingEquipment)}`);

section("C");
console.log("\n" + "=".repeat(70));
console.log("C  DO THE `item` CODES RESOLVE AGAINST items.json?");
console.log("=".repeat(70));
const codes = [...new Set(itemCodes)];
console.log(`  distinct item codes referenced by class+background starting equipment: ${codes.length}`);
const unresolved = [];
const ambiguousBareName = [];
for (const code of codes) {
	const [rawName, rawSource] = String(code).split("|");
	if (rawSource === undefined || rawSource === "") {
		const hits = itemsByLowerName.get(rawName.toLowerCase()) || [];
		if (hits.length === 0) unresolved.push(code);
		else if (hits.length > 1) ambiguousBareName.push(`${code} -> ${hits.map((h) => h.source).join("/")}`);
		continue;
	}
	if (!itemKeys.has(`${rawName.toLowerCase()}|${rawSource.toLowerCase()}`)) unresolved.push(code);
}
console.log(`  codes carrying an explicit |source: ${codes.filter((c) => String(c).includes("|")).length}`);
console.log(`  UNRESOLVED against items.json (case-insensitive name|source): ${unresolved.length}`);
for (const u of unresolved.slice(0, 5)) console.log(`    ${u}`);
console.log(`  bare-name codes matching MORE THAN ONE item: ${ambiguousBareName.length}`);
for (const a of ambiguousBareName.slice(0, 3)) console.log(`    ${a}`);
console.log(`  case check — does the code's name match the item's stored name exactly? mismatches: ${codes.filter((c) => {
	const [n, s] = String(c).split("|");
	const hits = itemsByLowerName.get(n.toLowerCase()) || [];
	return hits.length > 0 && !hits.some((h) => h.name === n && (s === undefined || h.source === s));
}).length} of ${codes.length}`);

section("D");
console.log("\n" + "=".repeat(70));
console.log("D  PACKS — packContents");
console.log("=".repeat(70));
const packs = items.filter((it) => Array.isArray(it.packContents));
console.log(`  packs: ${packs.length} — ${packs.map((p) => p.name).join(", ")}`);
const pcShapes = [];
const pcSpecial = [];
let pcUnresolved = 0;
for (const p of packs) {
	for (const el of p.packContents) {
		if (typeof el === "string") {
			pcShapes.push("bare string");
			if (!itemsByLowerName.has(el.split("|")[0].toLowerCase())) pcUnresolved++;
			continue;
		}
		if (!el || typeof el !== "object") { pcShapes.push(typeof el); continue; }
		pcShapes.push(`{${Object.keys(el).sort().join(",")}}`);
		if (typeof el.item === "string" && !itemsByLowerName.has(el.item.split("|")[0].toLowerCase())) pcUnresolved++;
		if (el.special !== undefined) pcSpecial.push(String(el.special));
	}
}
printHist("packContents element shapes:", pcShapes);
console.log(`  packContents entries whose item name does NOT resolve in items.json: ${pcUnresolved}`);
printHist("packContents {special} values:", pcSpecial);
console.log("  full example — Burglar's Pack packContents:");
const burglar = packs.find((p) => /burglar/i.test(p.name));
console.log(`    ${JSON.stringify(burglar && burglar.packContents)}`);
section("E");
console.log("\n" + "=".repeat(70));
console.log("E  THE ODD ELEMENTS, IN FULL");
console.log("=".repeat(70));
for (const c of classes) {
	for (const row of c.startingEquipment.defaultData) {
		for (const [k, arr] of Object.entries(row)) {
			if (!Array.isArray(arr)) continue;
			if (arr.some((el) => el && typeof el === "object" && (el.equipmentTypes !== undefined || el.special !== undefined))) {
				console.log(`  ${c.name} option ${k}: ${JSON.stringify(arr)}`);
			}
		}
	}
}
const bgWithBareString = backgrounds.find((bg) =>
	(bg.startingEquipment || []).some((row) => Object.values(row).some((arr) => Array.isArray(arr) && arr.some((el) => typeof el === "string"))),
);
console.log(`  background with bare-string elements — ${bgWithBareString && bgWithBareString.name}: ${JSON.stringify(bgWithBareString && bgWithBareString.startingEquipment)}`);
const groupCodes = ["holy symbol|xphb", "druidic focus|xphb", "gaming set|xphb", "musical instrument|xphb", "arcane focus|xphb"];
const srcPath = path.join(__dirname, "..", "data-source", "5etools-src-main", "5etools-src-main", "data", "items.json");
if (fs.existsSync(srcPath)) {
	const src = JSON.parse(fs.readFileSync(srcPath, "utf8"));
	const groups = src.itemGroup || [];
	console.log(`  data-source itemGroup entries: ${groups.length}`);
	for (const code of groupCodes) {
		const [n, s] = code.split("|");
		const g = groups.find((x) => String(x.name).toLowerCase() === n && String(x.source).toLowerCase() === s);
		if (!g) { console.log(`    ${code}: NOT an itemGroup`); continue; }
		const members = (g.items || []).map((m) => String(m).split("|")[0]);
		const inItems = members.filter((m) => itemsByLowerName.has(m.toLowerCase()));
		console.log(`    ${g.name}|${g.source}: type=${JSON.stringify(g.type)} members=${members.length} present in data/items.json=${inItems.length} -> ${members.join(", ")}`);
	}
} else {
	console.log("  data-source/items.json not present");
}
console.log(`  items.json entries named Spellbook: ${(itemsByLowerName.get("spellbook") || []).map((i) => `${i.name}|${i.source}`).join(", ") || "(none)"}`);
console.log(`  items.json names matching /book|spellbook/i: ${items.filter((i) => /book/i.test(i.name)).map((i) => `${i.name}|${i.source}`).join(", ") || "(none)"}`);
for (const c of classes) {
	const keys = Object.keys(c.startingEquipment.defaultData[0] || {});
	if (keys.length > 2) console.log(`  class with more than two options — ${c.name}: ${JSON.stringify(c.startingEquipment.defaultData)}`);
}
console.log(`  items.json type-code counts for the category vocabulary: AT=${items.filter((i) => String(i.type || "").split("|")[0] === "AT").length} GS=${items.filter((i) => String(i.type || "").split("|")[0] === "GS").length} INS=${items.filter((i) => String(i.type || "").split("|")[0] === "INS" && i.rarity === "none").length}`);
section("F");
console.log("\n" + "=".repeat(70));
console.log("F  RESOLVING THE CATEGORY-LIKE CODES AND {special}");
console.log("=".repeat(70));
const scf = items.filter((i) => String(i.type || "").split("|")[0] === "SCF");
console.log(`  items.json SCF (spellcasting focus) items: ${scf.length}`);
for (const i of scf) console.log(`    ${`${i.name}|${i.source}`.padEnd(28)} scfType=${JSON.stringify(i.scfType)} rarity=${JSON.stringify(i.rarity)}`);
if (fs.existsSync(srcPath)) {
	const src = JSON.parse(fs.readFileSync(srcPath, "utf8"));
	const basePath = path.join(path.dirname(srcPath), "items-base.json");
	const base = fs.existsSync(basePath) ? JSON.parse(fs.readFileSync(basePath, "utf8")) : {};
	const lists = { "items.item": src.item || [], "items.itemGroup": src.itemGroup || [], "items-base.baseitem": base.baseitem || [] };
	for (const [label, list] of Object.entries(lists)) {
		const hits = list.filter((e) => /spellbook/i.test(String(e.name || "")));
		console.log(`  source ${label}: ${list.length} entries; /spellbook/i -> ${hits.map((h) => `${h.name}|${h.source}(type=${h.type})`).join(", ") || "(none)"}`);
	}
}
const ammo = packs.find((p) => /^arrows/i.test(p.name));
console.log(`  Arrows (20) packContents: ${JSON.stringify(ammo && ammo.packContents)}`);
console.log("\ndone");
