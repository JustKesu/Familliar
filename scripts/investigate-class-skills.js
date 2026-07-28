/*
 * investigate-class-skills.js
 * ============================
 * One-off investigation: where do a class's chooseable skill
 * proficiencies live in data/classes.json? Prints a SUMMARY ONLY
 * (per CLAUDE.md) — never whole entries or files.
 *
 * Run: node scripts/investigate-class-skills.js
 */

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

const classes = readJson("classes.json").filter((e) => e.entryType === "class");

console.log(`Total class entries: ${classes.length}`);

const withSkills = [];
const shapeCounts = new Map();

for (const cls of classes) {
	const prof = cls.startingProficiencies || {};
	const skills = prof.skills;
	if (skills === undefined) continue;
	withSkills.push({ name: cls.name, source: cls.source, skills });

	let shape;
	if (Array.isArray(skills) && skills.length === 1 && skills[0] && typeof skills[0] === "object") {
		const keys = Object.keys(skills[0]);
		if (keys.length === 1 && keys[0] === "choose" && skills[0].choose && Array.isArray(skills[0].choose.from)) {
			const count = skills[0].choose.count;
			shape = `[{choose:{from:[...${skills[0].choose.from.length}], count:${count === undefined ? "1(default)" : count}}}]`;
		} else {
			shape = `[{keys:${JSON.stringify(keys)}}]`;
		}
	} else {
		shape = `other:${typeof skills}:${Array.isArray(skills) ? "array-len-" + skills.length : ""}`;
	}
	shapeCounts.set(shape, (shapeCounts.get(shape) || 0) + 1);
}

console.log(`Classes with startingProficiencies.skills: ${withSkills.length} / ${classes.length}`);
console.log(`Distinct shapes: ${shapeCounts.size}`);
for (const [shape, count] of shapeCounts.entries()) {
	console.log(`  ${count}x ${shape}`);
}

console.log("Examples:");
for (const ex of withSkills.slice(0, 3)) {
	console.log(`  ${ex.name} (${ex.source}): ${truncate(JSON.stringify(ex.skills), 150)}`);
}

const missing = classes.filter((c) => (c.startingProficiencies || {}).skills === undefined);
if (missing.length > 0) {
	console.log(`Classes WITHOUT startingProficiencies.skills: ${missing.map((c) => c.name).join(", ")}`);
}

// Check "from" values across all — do any use something other than skill names (e.g. "any")?
const fromValueCounts = new Map();
for (const ex of withSkills) {
	const from = ex.skills?.[0]?.choose?.from;
	if (!Array.isArray(from)) continue;
	const key = from.length;
	fromValueCounts.set(key, (fromValueCounts.get(key) || 0) + 1);
}
console.log("Distinct 'from' list lengths across classes with the choose/from shape:");
for (const [len, count] of fromValueCounts.entries()) {
	console.log(`  length ${len}: ${count} classes`);
}
