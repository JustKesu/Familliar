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

const classFeatures = readJson("class-features.json");
const subclassFeatures = readJson("subclass-features.json");

const EXPERTISE_TAG = "{@variantrule Expertise|XPHB}";
const isExpertiseName = (name) => /expertise/i.test(name || "");

function mentionsExpertiseTag(entries) {
	return JSON.stringify(entries).includes(EXPERTISE_TAG);
}

console.log("=== PART A: features mentioning the Expertise variantrule tag, not named 'Expertise' ===");

const classHits = classFeatures.filter((f) => mentionsExpertiseTag(f.entries) && !isExpertiseName(f.name));
const subclassHits = subclassFeatures.filter((f) => mentionsExpertiseTag(f.entries) && !isExpertiseName(f.name));

console.log(`class-features.json hits: ${classHits.length}`);
for (const f of classHits) {
	console.log(`  "${f.name}" className=${f.className} level=${f.level} source=${f.source}`);
	console.log(`    ${truncate(firstSentence(f.entries), 200)}`);
}

console.log(`subclass-features.json hits: ${subclassHits.length}`);
for (const f of subclassHits) {
	console.log(`  "${f.name}" className=${f.className} subclassShortName=${f.subclassShortName} level=${f.level} source=${f.source}`);
	console.log(`    ${truncate(firstSentence(f.entries), 200)}`);
}

console.log("\n=== PART B: Infiltration Expertise prose ===");
const infiltration = subclassFeatures.filter((f) => f.name === "Infiltration Expertise");
console.log(`count: ${infiltration.length}`);
for (const f of infiltration) {
	console.log(`  className=${f.className} subclassShortName=${f.subclassShortName} level=${f.level} source=${f.source}`);
	console.log(`    ${truncate(firstSentence(f.entries), 300)}`);
}
