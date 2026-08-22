/*
 * TEMPORARY scaffolding (D14): field-shape summary for the XMM beast pool, so
 * the extractor's keep/drop list is decided from the data, not guessed.
 * SUMMARY ONLY — counts and at most 3 short examples (CLAUDE.md).
 */

const fs = require("fs");
const path = require("path");

const BESTIARY_DIR = path.join(
	__dirname,
	"..",
	"data-source",
	"5etools-src-main",
	"5etools-src-main",
	"data",
	"bestiary",
);

const monsters = JSON.parse(fs.readFileSync(path.join(BESTIARY_DIR, "bestiary-xmm.json"), "utf8")).monster;

function crToNumber(cr) {
	const raw = typeof cr === "object" && cr !== null ? cr.cr : cr;
	if (raw === undefined || raw === null) return undefined;
	if (raw === "1/8") return 0.125;
	if (raw === "1/4") return 0.25;
	if (raw === "1/2") return 0.5;
	const n = Number(raw);
	return Number.isNaN(n) ? undefined : n;
}

function isBeast(m) {
	const types = Array.isArray(m.type) ? m.type : [m.type];
	return types.some((t) => (typeof t === "string" ? t === "beast" : t && t.type === "beast"));
}

const beasts = monsters.filter((m) => isBeast(m) && crToNumber(m.cr) !== undefined && crToNumber(m.cr) <= 6);
console.log("XMM beasts CR<=6:", beasts.length);

const keyCounts = {};
for (const b of beasts) for (const k of Object.keys(b)) keyCounts[k] = (keyCounts[k] || 0) + 1;
console.log("top-level keys (key=count):");
console.log(
	Object.keys(keyCounts)
		.sort()
		.map((k) => `${k}=${keyCounts[k]}`)
		.join(" "),
);

// shape probes
const typeShapes = new Set(beasts.map((b) => (typeof b.type === "string" ? "string" : Object.keys(b.type).sort().join("+"))));
console.log("\n`type` shapes:", [...typeShapes]);
const crShapes = new Set(beasts.map((b) => (typeof b.cr === "object" ? "object:" + Object.keys(b.cr).sort().join("+") : typeof b.cr)));
console.log("`cr` shapes:", [...crShapes], "raw values:", [...new Set(beasts.map((b) => (typeof b.cr === "object" ? b.cr.cr : b.cr)))].join(","));
const sizeShapes = new Set(beasts.map((b) => (Array.isArray(b.size) ? `array(${b.size.length})` : typeof b.size)));
console.log("`size` shapes:", [...sizeShapes]);
const acShapes = new Set(beasts.flatMap((b) => (b.ac || []).map((a) => (typeof a === "object" ? "object:" + Object.keys(a).sort().join("+") : typeof a))));
console.log("`ac` element shapes:", [...acShapes]);
const hpShapes = new Set(beasts.map((b) => "object:" + Object.keys(b.hp || {}).sort().join("+")));
console.log("`hp` shapes:", [...hpShapes]);
const speedKeys = new Set(beasts.flatMap((b) => Object.keys(b.speed || {})));
console.log("`speed` keys:", [...speedKeys]);
const speedValShapes = new Set(beasts.flatMap((b) => Object.values(b.speed || {}).map((v) => (typeof v === "object" ? "object:" + Object.keys(v).sort().join("+") : typeof v))));
console.log("`speed` value shapes:", [...speedValShapes]);

const familiars = ["Bat", "Cat", "Frog", "Hawk", "Lizard", "Octopus", "Owl", "Rat", "Raven", "Spider", "Weasel"];
const missing = familiars.filter((n) => !beasts.some((b) => b.name === n));
console.log("\nFind Familiar names missing from the XMM CR<=6 beast pool:", missing.length ? missing.join(",") : "(none)");

console.log("_copy present:", beasts.filter((b) => b._copy).length, "| _versions present:", beasts.filter((b) => b._versions).length);
console.log("raw byte total:", beasts.reduce((s, b) => s + JSON.stringify(b).length, 0));
console.log("examples:", beasts.slice(0, 3).map((b) => `${b.name} (CR ${JSON.stringify(b.cr)})`).join(" | "));
