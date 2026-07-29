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

function firstSentence(entries) {
	// entries can be array of strings/objects; find first string entry.
	const stack = Array.isArray(entries) ? [...entries] : [entries];
	while (stack.length) {
		const e = stack.shift();
		if (typeof e === "string") return e;
		if (e && typeof e === "object") {
			if (Array.isArray(e.entries)) stack.unshift(...e.entries);
			else if (Array.isArray(e.items)) stack.unshift(...e.items);
		}
	}
	return "";
}

function hasSkillTag(entries) {
	const json = JSON.stringify(entries);
	return json.includes("{@skill");
}

console.log("=== PART A: expertise ===");

const classFeatures = readJson("class-features.json");
const subclassFeatures = readJson("subclass-features.json");

const isExpertiseName = (name) => /expertise/i.test(name || "");

const classExpertise = classFeatures.filter((f) => isExpertiseName(f.name));
const subclassExpertise = subclassFeatures.filter((f) => isExpertiseName(f.name));

console.log(`\n-- 1. Expertise-named features (class-features.json: ${classExpertise.length}, subclass-features.json: ${subclassExpertise.length}) --`);
for (const f of classExpertise) {
	console.log(`  [class] "${f.name}" className=${f.className} classSource=${f.classSource} level=${f.level} source=${f.source}`);
}
for (const f of subclassExpertise) {
	console.log(`  [subclass] "${f.name}" className=${f.className} classSource=${f.classSource} subclassShortName=${f.subclassShortName} level=${f.level} source=${f.source}`);
}

console.log("\n-- 2. Structured skill-count field? --");
const classes = readJson("classes.json").filter((e) => e.entryType === "class");
const allExpertise = [...classExpertise.map((f) => ({ ...f, kind: "class" })), ...subclassExpertise.map((f) => ({ ...f, kind: "subclass" }))];

for (const f of allExpertise) {
	const label = f.kind === "class" ? `[class] ${f.name} (${f.className})` : `[subclass] ${f.name} (${f.className}/${f.subclassShortName})`;
	const cls = classes.find((c) => c.name === f.className && c.source === f.classSource);
	let tableGroupHit = "NO";
	if (cls && Array.isArray(cls.classTableGroups)) {
		const hit = cls.classTableGroups.find((g) => JSON.stringify(g.title || g.colLabels || "").toLowerCase().includes("expertise"));
		if (hit) tableGroupHit = `YES - classTableGroups entry: ${truncate(JSON.stringify(hit), 200)}`;
	}
	const structuredKeys = Object.keys(f).filter((k) => !["name", "className", "classSource", "subclassShortName", "level", "source", "entries", "page", "entryType"].includes(k));
	const featureFieldHit = structuredKeys.length > 0 ? `YES - keys: ${structuredKeys.join(", ")} = ${truncate(JSON.stringify(structuredKeys.map((k) => f[k])), 200)}` : "NO";
	console.log(`  ${label}`);
	console.log(`    classTableGroups expertise column: ${tableGroupHit}`);
	console.log(`    feature-level structured field: ${featureFieldHit}`);
}

console.log("\n-- 3. Prose count wording (up to 3 examples) --");
for (const f of allExpertise.slice(0, 3)) {
	console.log(`  "${f.name}": ${truncate(firstSentence(f.entries), 200)}`);
}

console.log("\n-- 4. Expertise via optionalfeatureProgression? --");
const optFeatProgHits = readJson("classes.json")
	.filter((e) => e.entryType === "subclass" && e.optionalfeatureProgression)
	.filter((sc) => JSON.stringify(sc.optionalfeatureProgression).toLowerCase().includes("expertise"));
const optFeatures = readJson("optional-features.json");
const optFeatExpertiseHits = optFeatures.filter((f) => isExpertiseName(f.name));
if (optFeatProgHits.length === 0 && optFeatExpertiseHits.length === 0) {
	console.log("  NO - expertise does not appear in optionalfeatureProgression or optional-features.json");
} else {
	console.log(`  YES - optionalfeatureProgression subclasses mentioning expertise: ${optFeatProgHits.length}`);
	for (const sc of optFeatProgHits) console.log(`    ${sc.name} (${sc.className}): ${truncate(JSON.stringify(sc.optionalfeatureProgression), 200)}`);
	console.log(`  optional-features.json entries named "Expertise": ${optFeatExpertiseHits.length}`);
	for (const f of optFeatExpertiseHits.slice(0, 3)) console.log(`    ${f.name} (${f.source})`);
}

console.log("\n=== PART B: species and skillProficiencies ===");

const species = readJson("species.json");
console.log(`\nTotal species records: ${species.length}`);

function findSkillProfPaths(obj, pathSoFar, hits) {
	if (!obj || typeof obj !== "object") return;
	if (Array.isArray(obj)) {
		obj.forEach((item, i) => findSkillProfPaths(item, `${pathSoFar}[${i}]`, hits));
		return;
	}
	for (const key of Object.keys(obj)) {
		const p = pathSoFar ? `${pathSoFar}.${key}` : key;
		if (key === "skillProficiencies") hits.push({ path: p, value: obj[key] });
		else findSkillProfPaths(obj[key], p, hits);
	}
}

const withSkillProf = [];
const withoutSkillProf = [];
for (const sp of species) {
	const hits = [];
	findSkillProfPaths(sp, "", hits);
	if (hits.length > 0) withSkillProf.push({ name: sp.name, source: sp.source, hits });
	else withoutSkillProf.push(sp);
}

console.log(`\n-- 5. skillProficiencies presence --`);
console.log(`  With skillProficiencies: ${withSkillProf.length}`);
console.log(`  Without: ${withoutSkillProf.length}`);
console.log(`  Names+source of species WITH skillProficiencies:`);
for (const sp of withSkillProf) {
	console.log(`    ${sp.name} (${sp.source}) at path(s): ${sp.hits.map((h) => h.path).join(", ")}`);
}
console.log(`  Up to 3 examples of the field in JSON form:`);
for (const sp of withSkillProf.slice(0, 3)) {
	console.log(`    ${sp.name}: ${truncate(JSON.stringify(sp.hits[0].value), 300)}`);
}

console.log(`\n-- 6. Fixed skill vs choice --`);
let fixedCount = 0;
let chooseCount = 0;
let fixedExample = null;
let chooseExample = null;
for (const sp of withSkillProf) {
	for (const h of sp.hits) {
		const val = h.value;
		const arr = Array.isArray(val) ? val : [val];
		for (const entry of arr) {
			if (entry && typeof entry === "object" && entry.choose) {
				chooseCount++;
				if (!chooseExample) chooseExample = { name: sp.name, value: entry };
			} else {
				fixedCount++;
				if (!fixedExample) fixedExample = { name: sp.name, value: entry };
			}
		}
	}
}
console.log(`  Fixed (named) skill entries: ${fixedCount}`);
if (fixedExample) console.log(`    example: ${fixedExample.name}: ${truncate(JSON.stringify(fixedExample.value), 200)}`);
console.log(`  Choice ("choose") skill entries: ${chooseCount}`);
if (chooseExample) console.log(`    example: ${chooseExample.name}: ${truncate(JSON.stringify(chooseExample.value), 200)}`);

console.log(`\n-- 7. {@skill} tag in entries outside skillProficiencies --`);
const withSkillTag = species.filter((sp) => hasSkillTag(sp.entries));
console.log(`  Species with {@skill} in entries: ${withSkillTag.length}`);
for (const sp of withSkillTag.slice(0, 3)) {
	console.log(`    ${sp.name} (${sp.source})`);
}
