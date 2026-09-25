/*
 * Investigation for D186 (species traits in Actions, follow-up to D185). Prints a SUMMARY only; writes nothing.
 * Re-implements, identically, actionTableFeatureData.ts (D86 + D182 + the D186 attack-replacement frame),
 * speciesTraitMinLevel and speciesTraitUses, then reports:
 * 1. every action-table candidate whose group the D186 frame changes, across all four feature files + species;
 * 2. level-gated species traits, and traits that mention a level the gate does not parse;
 * 3. species traits with tracked uses, and qualifying ones without;
 * 4. species traits in the Actions tab before (D185) and after (D186).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const read = (n) => JSON.parse(fs.readFileSync(path.join(dir, n), "utf8"));
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const body = (n) => (Array.isArray(n.entries) ? n.entries : n.entry !== undefined ? [n.entry] : []);
const REST_TAG = /\{@variantrule\s+(Long Rest|Short Rest)\b/i;
function hasRestTag(n) {
	if (typeof n === "string") return REST_TAG.test(n);
	if (Array.isArray(n)) return n.some(hasRestTag);
	if (!isRecord(n)) return false;
	return hasRestTag(body(n)) || hasRestTag(n.items) || hasRestTag(n.rows) || (isRecord(n.row) && hasRestTag(n.row.row));
}
function leaves(n, out = []) {
	if (typeof n === "string") out.push(n);
	else if (Array.isArray(n)) n.forEach((c) => leaves(c, out));
	else if (isRecord(n)) { leaves(body(n), out); leaves(n.items, out); leaves(n.rows, out); if (isRecord(n.row)) leaves(n.row.row, out); }
	return out;
}
const LEAD_IN = String.raw`\b(?:as|use|take|takes|taking|using|spend)\s+(?:a|an|your|one)\s+`;
const BASE = [
	{ t: "bonus", re: new RegExp(LEAD_IN + String.raw`\{@variantrule Bonus Action\b`, "gi") },
	{ t: "reaction", re: new RegExp(LEAD_IN + String.raw`\{@variantrule Reaction\b`, "gi") },
	{ t: "action", re: /\b(?:as|take|takes|taking|use)\s+(?:the|a|an|one)\s+\{@action [^}]+\}\s+actions?(?!\s+(?:as|using)\s+(?:a|an|your)\s+\{@variantrule (?:Bonus Action|Reaction)\b)/gi },
	{ t: "action", re: /\b(?:take|takes|taking)\s+(?:both\s+)?the\s+\{@action [^}]+\}\s+and\s+(?:the\s+)?\{@action [^}]+\}\s+actions(?!\s+as\s+(?:a|an|your)\s+\{@variantrule (?:Bonus Action|Reaction)\b)/gi },
	{ t: "other", re: /\(?no action required\)?/gi },
];
const REPLACE_FRAME = { t: "action", re: /(?<=\{@action Attack\b[^}]*\}\s+action\b[^.]*)\breplace\s+one\s+of\s+(?:your|the|those)\s+attacks\b/gi };
const TRIGGER = /\b(?:when|whenever|if|after|once|until|before)\s+(?:you|it|they|the target|a creature)\s+(?:can\s+)?$/i;
function classify(f, frames) {
	for (const text of leaves(f.entries)) {
		let first = null;
		for (const fr of frames) for (const m of text.matchAll(fr.re)) {
			if (TRIGGER.test(text.slice(Math.max(0, m.index - 40), m.index))) continue;
			if (!first || m.index < first.at) first = { t: fr.t, at: m.index };
			break;
		}
		if (first) return first.t;
	}
	return "other";
}
const before = (f) => classify(f, BASE);
const after = (f) => classify(f, [...BASE, REPLACE_FRAME]);
const plainLeaves = (n) => leaves(n).map((s) => s.replace(/\{@\w+\s+([^|}]*)[^}]*\}/g, "$1"));

// ---- level gate, identical to speciesTraitNames.ts ----
const GATE = /^\s*(?:When you reach|Starting at|Once you reach)\s+(?:character level (\d+)|(\d+)(?:st|nd|rd|th) level)\b/i;
function minLevel(t) {
	const first = (t.entries ?? [])[0];
	const m = typeof first === "string" ? first.replace(/\{@\w+\s+([^|}]*)[^}]*\}/g, "$1").match(GATE) : null;
	return m ? Number(m[1] ?? m[2]) : null;
}
const LEVEL_MENTION = /\bcharacter level \d+|\b\d+(?:st|nd|rd|th) level\b/i;

// ---- tracked uses, identical to resources.ts's speciesTraitUses ----
const RESTS = String.raw`an?\s+((?:Short|Long)(?:\s+Rest)?(?:\s+or\s+(?:Short|Long))?\s+Rest)`;
const ONCE = new RegExp(String.raw`\bonce you\b[^.]{0,60}\byou can't (?:do so|use it|use this trait) again until you finish\s+` + RESTS, "i");
// The markup strip keeps a tag's first segment, so XPHB's {@variantrule Proficiency|XPHB|Proficiency Bonus} reads "Proficiency".
const PB = new RegExp(String.raw`\bnumber of times equal to your Proficiency(?: Bonus)?\b[^.]*?[,.]\s*(?:and\s+)?(?:you\s+)?regain(?:ing)?\s+all\s+expended\s+uses\s+when\s+you\s+finish\s+` + RESTS, "i");
const both = [];
function uses(t) {
	const text = plainLeaves(t.entries).join(" ");
	const pb = text.match(PB);
	const once = text.match(ONCE);
	if (pb && once) { both.push(t.name); return null; }
	if (pb) return { max: "PB", rest: pb[1] };
	return once ? { max: 1, rest: once[1] } : null;
}

const cands = [];
for (const f of ["class-features", "subclass-features", "feats", "optional-features"]) for (const r of read(`${f}.json`)) cands.push({ file: f, r });
const species = [];
for (const sp of read("species.json")) for (const e of sp.entries || []) if (isRecord(e) && typeof e.name === "string") species.push({ sp: `${sp.name}|${sp.source}`, r: e });

console.log("== 1. group changes from the attack-replacement frame ==");
let n = 0;
for (const { file, r } of [...cands, ...species.map((s) => ({ file: `species ${s.sp}`, r: s.r }))]) {
	const b = before(r);
	const a = after(r);
	const inTable = r.consumes !== undefined || hasRestTag(r.entries) || a !== "other";
	if (!inTable || a === b) continue;
	n++;
	console.log(`  ${file} | ${r.name}|${r.source ?? ""} | ${b} -> ${a}`);
}
console.log(`changed: ${n}`);

console.log("\n== 2. level gates ==");
const gated = new Map();
const unparsed = new Map();
for (const { sp, r } of species) {
	const lvl = minLevel(r);
	if (lvl !== null) gated.set(`${r.name} @${lvl}`, [...(gated.get(`${r.name} @${lvl}`) ?? []), sp]);
	else if (LEVEL_MENTION.test(plainLeaves(r.entries).join(" "))) unparsed.set(r.name, [...(unparsed.get(r.name) ?? []), sp]);
}
for (const [k, sps] of gated) console.log(`  gated ${k}: ${sps.join(", ")}`);
console.log(`  mention a level, not gated (${unparsed.size} names): ` + [...unparsed].map(([k, s]) => `${k} (${s.length})`).join("; "));

console.log("\n== 3. tracked uses ==");
const withUses = new Map();
const noUses = new Map();
for (const { sp, r } of species) {
	const u = uses(r);
	const q = r.consumes !== undefined || hasRestTag(r.entries) || after(r) !== "other";
	if (u) withUses.set(`${r.name} = ${u.max} / ${u.rest}`, [...(withUses.get(`${r.name} = ${u.max} / ${u.rest}`) ?? []), sp.split("|")[0]]);
	else if (q) noUses.set(r.name, (noUses.get(r.name) ?? 0) + 1);
}
for (const [k, sps] of withUses) console.log(`  ${k}: ${sps.length} (${sps.slice(0, 4).join(", ")}${sps.length > 4 ? ", …" : ""})`);
console.log(`  both patterns, two independent limits, no boxes: ${[...new Set(both)].join("; ")}`);
console.log(`  qualify under D185 but no boxes (${noUses.size} names): ` + [...noUses].map(([k, c]) => `${k}${c > 1 ? ` ×${c}` : ""}`).join("; "));

console.log("\n== 4. species traits in Actions, D185 -> D186 ==");
const d185 = species.filter(({ r }) => r.consumes !== undefined || hasRestTag(r.entries) || before(r) !== "other");
const d186 = species.filter(({ r }) => after(r) !== "other" || uses(r) !== null);
const key = ({ sp, r }) => `${r.name} [${sp}]`;
const s185 = new Set(d185.map(key));
const s186 = new Set(d186.map(key));
const count = (xs) => xs.reduce((m, x) => ((m[after(x.r)] = (m[after(x.r)] || 0) + 1), m), {});
console.log(`D185 ${d185.length}, D186 ${d186.length} by group ${JSON.stringify(count(d186))}`);
const names = (xs) => [...xs.reduce((m, x) => m.set(x.r.name, (m.get(x.r.name) ?? 0) + 1), new Map())].map(([k, c]) => `${k}${c > 1 ? ` ×${c}` : ""}`).join("; ");
console.log(`  removed: ${names(d185.filter((x) => !s186.has(key(x))))}`);
console.log(`  added: ${names(d186.filter((x) => !s185.has(key(x))))}`);
console.log(`  kept: ${names(d186.filter((x) => s185.has(key(x))))}`);
