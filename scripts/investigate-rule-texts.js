// R15 STEP 1: are the rule texts for the four detail drawers present, real and renderable?
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "data-source", "5etools-src-main", "5etools-src-main", "data");
const read = (name) => JSON.parse(fs.readFileSync(path.join(SRC, name), "utf8"));

const tagsTs = fs.readFileSync(path.join(ROOT, "src", "markup", "tags.ts"), "utf8");
const handled = new Set();
for (const table of ["REFERENCE_TAGS", "EMPHASIS_TAGS", "VALUE_TAGS", "LABEL_TAGS"]) {
	const start = tagsTs.indexOf(`const ${table}`);
	const body = tagsTs.slice(start, tagsTs.indexOf("\n}", start));
	for (const m of body.matchAll(/^\t'?([A-Za-z0-9]+)'?:/gm)) handled.add(m[1]);
}

function tagsIn(node, out) {
	if (typeof node === "string") for (const m of node.matchAll(/\{[@#]([A-Za-z0-9]+)/g)) out.add(m[1]);
	else if (Array.isArray(node)) node.forEach((n) => tagsIn(n, out));
	else if (node && typeof node === "object") Object.values(node).forEach((n) => tagsIn(n, out));
	return out;
}
const entryTypes = new Set();
function typesIn(node) {
	if (Array.isArray(node)) node.forEach(typesIn);
	else if (node && typeof node === "object") {
		if (node.type) entryTypes.add(node.type);
		Object.values(node).forEach(typesIn);
	}
}

const problems = [];
function report(kind, list, name) {
	const hits = list.filter((e) => e.name === name && e.source === "XPHB");
	if (hits.length === 0) {
		problems.push(`${kind} ${name}: missing`);
		console.log(`${kind.padEnd(12)} ${name.padEnd(20)} found=no`);
		return;
	}
	const e = hits[0];
	const isCopy = !!e._copy || !e.entries;
	const tags = [...tagsIn(e.entries ?? [], new Set())];
	typesIn(e.entries ?? []);
	const unknown = tags.filter((t) => !handled.has(t));
	if (hits.length > 1) problems.push(`${kind} ${name}: ${hits.length} XPHB records`);
	if (isCopy) problems.push(`${kind} ${name}: copy/no entries`);
	if (unknown.length) problems.push(`${kind} ${name}: unsupported tags ${unknown.join(",")}`);
	console.log(
		`${kind.padEnd(12)} ${name.padEnd(20)} found=yes chars=${JSON.stringify(e.entries ?? []).length} copy=${isCopy} tags=[${tags.join(",")}]`,
	);
}

const rules = read("variantrules.json").variantrule;
for (const n of ["Saving Throw", "Skill", "Expertise", "Proficiency", "Armor Training", "Weapon", "Passive Perception"])
	report("variantrule", rules, n);
const senses = read("senses.json").sense;
for (const n of ["Blindsight", "Darkvision", "Tremorsense", "Truesight"]) report("sense", senses, n);
const skills = read("skills.json").skill;
const xphbSkills = skills.filter((s) => s.source === "XPHB");
console.log(`skills XPHB count=${xphbSkills.length}`);
for (const s of xphbSkills) report("skill", skills, s.name);

const toolLang = rules.filter((r) => r.source === "XPHB" && /Tool|Language/.test(r.name)).map((r) => r.name);
console.log(`XPHB variantrules with Tool/Language in name: ${toolLang.join(", ") || "(none)"}`);
console.log(`renderer tags known: ${handled.size}`);
console.log(`nested entry types used: ${[...entryTypes].join(", ") || "(none)"}`);
const opening = (list, name) => String(list.find((e) => e.name === name && e.source === "XPHB").entries[0]).slice(0, 60);
for (const [list, name] of [[rules, "Saving Throw"], [rules, "Proficiency"], [rules, "Armor Training"], [skills, "Acrobatics"], [skills, "Stealth"], [senses, "Blindsight"]])
	console.log(`opening ${name}: ${opening(list, name)}`);
console.log(problems.length ? `PROBLEMS:\n  ${problems.join("\n  ")}` : "PROBLEMS: none");
