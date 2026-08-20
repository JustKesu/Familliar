/*
 * investigate-pact-prereq.js
 * Step 6a slice 1 follow-up: is a `pact: "<Name>"` prerequisite satisfiable
 * from the EI option list itself (i.e. "Pact of the <Name>" is an invocation
 * the player picks), or does it name something this app stores nowhere?
 * Summary only.
 */
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");
const readJson = (n) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, n), "utf8"));

const optionalFeatures = readJson("optional-features.json");
const ei = optionalFeatures.filter((f) => (f.featureType || []).includes("EI"));

const pactOptions = ei.filter((f) => /^pact of the /i.test(f.name));
console.log(`EI options total: ${ei.length}`);
console.log(`EI options named "Pact of the ...": ${pactOptions.length}`);
for (const p of pactOptions) console.log(`  ${p.name} (${p.source})`);

const withPact = ei.filter((f) => (f.prerequisite || []).some((a) => a.pact));
console.log("");
console.log(`EI options carrying a \`pact\` prerequisite: ${withPact.length}`);
for (const f of withPact) {
	const pacts = f.prerequisite.filter((a) => a.pact).map((a) => a.pact);
	console.log(`  ${f.name} (${f.source}) -> pact=${pacts.join(",")}`);
}

const withOf = ei.filter((f) => (f.prerequisite || []).some((a) => a.optionalfeature));
console.log("");
console.log(`EI options carrying an \`optionalfeature\` prerequisite: ${withOf.length}`);
for (const f of withOf) {
	const refs = f.prerequisite.flatMap((a) => a.optionalfeature || []);
	console.log(`  ${f.name} (${f.source}) -> ${refs.join(", ")}`);
}

console.log("");
console.log("`spell` prerequisite raw values across all EI/MM/etc options:");
const seen = new Set();
for (const f of optionalFeatures) {
	for (const a of f.prerequisite || []) {
		for (const s of a.spell || []) seen.add(typeof s === "string" ? s : `OBJECT:${Object.keys(s).sort().join("+")}`);
	}
}
console.log(`  ${[...seen].join(" | ")}`);

console.log("");
console.log("`feature` prerequisite raw values:");
const feat = new Set();
for (const f of optionalFeatures) for (const a of f.prerequisite || []) for (const s of a.feature || []) feat.add(s);
const featsJson = readJson("feats.json").filter((f) => f.category === "FS");
for (const a of featsJson) for (const p of a.prerequisite || []) for (const s of p.feature || []) feat.add(s);
console.log(`  ${[...feat].join(" | ")}`);

console.log("");
console.log("`level` prerequisite value shapes:");
const lvlShapes = new Map();
for (const f of optionalFeatures) {
	for (const a of f.prerequisite || []) {
		if (!a.level) continue;
		const shape = typeof a.level === "number" ? "number" : Object.keys(a.level).sort().join("+");
		lvlShapes.set(shape, (lvlShapes.get(shape) || 0) + 1);
	}
}
for (const [s, c] of lvlShapes) console.log(`  ${s}: ${c}`);
