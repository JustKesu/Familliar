/*
 * Investigation for "Actions: species traits". Prints a SUMMARY only; writes nothing.
 * Runs every named top-level species trait through the Actions tab's own tests:
 * isActionTableFeature (D86) OR classifyActionType != other (D182), re-implemented
 * identically to src/actions/actionTableFeatureData.ts and featureActionRowData.ts.
 * "Known max" = what computeCharacterResources would give IF species traits were in
 * its feature list (they are not today): implicit single use (D119), the only route
 * open to a trait, since species have no class table and are not in LEVEL_SCALED_USES.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const species = JSON.parse(fs.readFileSync(path.join(dir, "species.json"), "utf8"));

const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const REST_TAG = /\{@variantrule\s+(Long Rest|Short Rest)\b/i;
const body = (n) => (Array.isArray(n.entries) ? n.entries : n.entry !== undefined ? [n.entry] : []);
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
const FRAMES = [
	{ t: "bonus", re: new RegExp(LEAD_IN + String.raw`\{@variantrule Bonus Action\b`, "gi") },
	{ t: "reaction", re: new RegExp(LEAD_IN + String.raw`\{@variantrule Reaction\b`, "gi") },
	{ t: "action", re: /\b(?:as|take|takes|taking|use)\s+(?:the|a|an|one)\s+\{@action [^}]+\}\s+actions?(?!\s+(?:as|using)\s+(?:a|an|your)\s+\{@variantrule (?:Bonus Action|Reaction)\b)/gi },
	{ t: "action", re: /\b(?:take|takes|taking)\s+(?:both\s+)?the\s+\{@action [^}]+\}\s+and\s+(?:the\s+)?\{@action [^}]+\}\s+actions(?!\s+as\s+(?:a|an|your)\s+\{@variantrule (?:Bonus Action|Reaction)\b)/gi },
	{ t: "other", re: /\(?no action required\)?/gi },
];
const TRIGGER = /\b(?:when|whenever|if|after|once|until|before)\s+(?:you|it|they|the target|a creature)\s+(?:can\s+)?$/i;
function classify(f) {
	for (const text of leaves(f.entries)) {
		let first = null;
		for (const fr of FRAMES) for (const m of text.matchAll(fr.re)) {
			if (TRIGGER.test(text.slice(Math.max(0, m.index - 40), m.index))) continue;
			if (!first || m.index < first.at) first = { t: fr.t, at: m.index };
			break;
		}
		if (first) return first.t;
	}
	return "other";
}
const plain = (n, out = []) => {
	if (typeof n === "string") out.push(n.replace(/\{@\w+\s+([^|}]*)[^}]*\}/g, "$1"));
	else if (Array.isArray(n)) n.forEach((c) => plain(c, out));
	else if (isRecord(n)) Object.values(n).forEach((c) => plain(c, out));
	return out;
};
const EXPENDED = /\bexpended uses?\b|\bregain\b[^.]{0,60}\buses?\b|number of times equal to|can't (?:do so|use it|use this feature) again until you finish/i;
const SINGLE = /can't (?:do so|use it|use this feature) again until you finish an? (?:Short|Long) Rest/i;
const NW = "(?:one|two|three|four|five|six|seven|eight|nine|ten|\\d+)";
const COUNT = new RegExp(`\\bnumber of (?:times|uses)\\b|\\b(?:twice|thrice|${NW} (?:more |additional )?times)\\b(?! your\\b)|\\b${NW} uses\\b(?! of\\b)`, "i");
function knownMax(t) {
	if (!hasRestTag(t.entries) || !EXPENDED.test(plain(t.entries).join(" "))) return "no (not self-limited)";
	const text = plain(t.entries).join(" ");
	return SINGLE.test(text) && !COUNT.test(text) ? "yes: 1" : "no (count in prose / not in tables)";
}

const rows = [];
for (const sp of species) for (const e of sp.entries || []) {
	if (!isRecord(e) || typeof e.name !== "string") continue;
	const type = classify(e);
	const qual = hasRestTag(e.entries) || e.consumes !== undefined || type !== "other";
	rows.push({ sp: `${sp.name}|${sp.source}`, name: e.name, qual, group: type, max: qual ? knownMax(e) : "-", lvl: /\b(?:at|reach(?:es)?)\s+(?:character\s+)?level\s+\d+|\d+(?:st|nd|rd|th)\s+level/i.test(plain(e.entries).join(" ")) });
}
const q = rows.filter((r) => r.qual);
const cnt = (xs, f) => Object.entries(xs.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {})).map(([k, n]) => `${k} ${n}`).join(", ");
console.log(`species records ${species.length}; named top-level traits ${rows.length}; QUALIFY ${q.length} (${new Set(q.map((r) => r.name + r.sp)).size} distinct trait|species)`);
console.log("by source: " + cnt(q, (r) => r.sp.split("|")[1]));
console.log("by group: " + cnt(q, (r) => r.group));
console.log("via rest tag only vs R-phrase only: " + cnt(q, (r) => r.group === "other" ? "rest-tag, Other" : "R-phrase group"));
console.log("known max if fed to resource model: " + cnt(q, (r) => r.max));
console.log(`text mentions a character level (gating hint): ${q.filter((r) => r.lvl).length} of ${q.length}`);
console.log("\nspecies | trait | group | known max | level in text");
for (const r of q.sort((a, b) => a.sp.localeCompare(b.sp))) console.log(`${r.sp} | ${r.name} | ${r.group} | ${r.max} | ${r.lvl ? "Y" : ""}`);
