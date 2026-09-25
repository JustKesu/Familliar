// Investigation (D46): what 5etools actions.json holds for the sheet's "Actions in Combat" rows.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const SRC = path.join(ROOT, "data-source", "5etools-src-main", "5etools-src-main", "data");
const FILE = path.join(SRC, "actions.json");

// Copied from src/markup/tags.ts getHandledTagNames() and Markup.tsx TypedEntry cases.
const HANDLED_TAGS = new Set(["b", "i", "h", "atkr", "actSave", "actSaveSuccess", "actSaveFail", "actTrigger", "actResponse",
	"damage", "dice", "hit", "dc", "chance", "scaledamage", "scaledice", "tip", "recharge",
	"action", "class", "condition", "creature", "deck", "feat", "hazard", "item", "itemMastery", "itemProperty", "language",
	"object", "optfeature", "race", "sense", "skill", "spell", "status", "table", "variantrule", "deity", "subclass",
	"quickref", "classFeature", "subclassFeature", "book", "filter", "5etools"]);
const HANDLED_TYPES = new Set([undefined, "entries", "section", "inset", "insetReadaloud", "list", "item", "itemSpell", "itemSub",
	"table", "options", "dice", "bonus", "bonusSpeed", "cell", "refClassFeature", "refSubclassFeature", "refOptionalfeature",
	"refFeat", "abilityDc", "statblock"]);

console.log("== 1. file");
if (!fs.existsSync(FILE)) { console.log("MISSING", FILE); process.exit(0); }
const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
console.log(`size ${fs.statSync(FILE).size} B, top-level keys: ${Object.keys(raw).join(", ")}`);
const all = raw.action;
console.log(`entries: ${all.length}, with _copy: ${all.filter((a) => a._copy).length}`);

const bySource = {};
for (const a of all) bySource[a.source] = (bySource[a.source] || 0) + 1;
console.log("by source:", JSON.stringify(bySource));

const walk = (node, visit) => {
	if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
	if (node && typeof node === "object") { visit(node); for (const v of Object.values(node)) walk(v, visit); }
};
const strings = (node, out = []) => {
	if (typeof node === "string") out.push(node);
	else if (Array.isArray(node)) node.forEach((n) => strings(n, out));
	else if (node && typeof node === "object") Object.values(node).forEach((n) => strings(n, out));
	return out;
};

console.log("\n== 2/3. XPHB inventory: name | time | extra fields | top entries/strings | group from time");
const xphb = all.filter((a) => a.source === "XPHB");
const BASE = new Set(["name", "source", "page", "entries", "time"]);
const unitGroup = { action: "Action", bonus: "Bonus Action", reaction: "Reaction" };
for (const a of xphb) {
	const extra = Object.keys(a).filter((k) => !BASE.has(k)).map((k) => (k === "seeAlsoAction" || k === "fromVariant" ? `${k}=${JSON.stringify(a[k])}` : k));
	const groups = (a.time || []).map((t) => (typeof t === "object" ? unitGroup[t.unit] ?? `?${t.unit}` : "?string"));
	const group = !a.time ? "NO time" : [...new Set(groups)].join("/");
	console.log(`${a.name} | ${JSON.stringify(a.time)} | ${extra.join(", ") || "-"} | ${a.entries?.length ?? 0}/${strings(a.entries).length} | ${group}`);
}

console.log("\n== 2b. non-XPHB");
const xphbNames = new Set(xphb.map((a) => a.name));
const others = all.filter((a) => a.source !== "XPHB");
const reprinted = others.filter((a) => (a.reprintedAs || []).some((r) => String(r.uid ?? r).endsWith("|XPHB")));
console.log(`non-XPHB: ${others.length}; with reprintedAs -> XPHB: ${reprinted.length}; same name as an XPHB entry: ${others.filter((a) => xphbNames.has(a.name)).length}`);
for (const a of others.filter((a) => a.source !== "PHB")) console.log(`  ${a.name}|${a.source} time=${JSON.stringify(a.time)} reprintedAs=${JSON.stringify(a.reprintedAs ?? null)} fromVariant=${JSON.stringify(a.fromVariant ?? null)}`);
const phbNoReprint =others.filter((a) => a.source === "PHB" && !reprinted.includes(a));
console.log(`PHB without reprintedAs->XPHB: ${phbNoReprint.map((a) => a.name).join(", ") || "none"}`);
const reprintMismatch = reprinted.filter((a) => a.reprintedAs.some((r) => { const n = String(r.uid ?? r).split("|")[0]; return !xphbNames.has(n); }));
console.log(`reprintedAs target not an XPHB name: ${reprintMismatch.map((a) => `${a.name}->${JSON.stringify(a.reprintedAs)}`).join("; ") || "none"}`);
console.log(`reprintedAs examples: ${reprinted.slice(0, 3).map((a) => `${a.name}|${a.source}->${JSON.stringify(a.reprintedAs)}`).join("; ")}`);

console.log("\n== 4. markup tags / entry types inside XPHB entries");
const tagCount = {}, tagExample = {};
for (const s of strings(xphb.map((a) => a.entries))) {
	for (const m of s.matchAll(/\{@(\w+)\s?([^}]*)\}/g)) {
		tagCount[m[1]] = (tagCount[m[1]] || 0) + 1;
		tagExample[m[1]] ??= m[0];
	}
}
for (const [t, n] of Object.entries(tagCount).sort()) console.log(`tag ${t} x${n} ${HANDLED_TAGS.has(t) ? "ok" : "UNHANDLED"} e.g. ${tagExample[t]}`);
const typeCount = {};
walk(xphb.map((a) => a.entries), (o) => { if (o.type) typeCount[o.type] = (typeCount[o.type] || 0) + 1; });
for (const [t, n] of Object.entries(typeCount)) console.log(`type ${t} x${n} ${HANDLED_TYPES.has(t) ? "ok" : "UNHANDLED"}`);
const nonStringTop = xphb.filter((a) => (a.entries || []).some((e) => typeof e !== "string")).map((a) => a.name);
console.log(`XPHB entries with non-string top-level entries: ${nonStringTop.join(", ") || "none"}`);

console.log("\n== 5. {@action X|src} tags across data/*.json (the app's extracted data)");
const refs = {};
for (const f of fs.readdirSync(path.join(ROOT, "data")).filter((n) => n.endsWith(".json"))) {
	const text = fs.readFileSync(path.join(ROOT, "data", f), "utf8");
	for (const m of text.matchAll(/\{@action ([^}|]+)(?:\|([^}|]*))?(?:\|([^}]*))?\}/g)) {
		const key = `${m[1]}|${m[2] || "(none)"}`;
		refs[key] = (refs[key] || 0) + 1;
	}
}
const bySrc = {};
for (const [k, n] of Object.entries(refs)) { const s = k.split("|")[1]; bySrc[s] = (bySrc[s] || 0) + n; }
console.log("occurrences by source arg:", JSON.stringify(bySrc));
const missing = Object.keys(refs).filter((k) => k.endsWith("|XPHB") && !xphbNames.has(k.split("|")[0]));
console.log(`distinct targets: ${Object.keys(refs).length}; XPHB targets not in actions.json XPHB: ${missing.join(", ") || "none"}`);
console.log("top targets:", Object.entries(refs).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} x${n}`).join(", "));
const unreferenced = xphb.map((a) => a.name).filter((n) => !refs[`${n}|XPHB`]);
console.log(`XPHB actions never referenced as {@action X|XPHB}: ${unreferenced.join(", ") || "none"}`);

console.log("\n== 6. size");
const subset = JSON.stringify(xphb, null, "\t");
console.log(`XPHB subset as writeJson would write it: ${Buffer.byteLength(subset)} B`);
for (const f of ["languages.json", "backgrounds.json", "feats.json"]) {
	const p = path.join(ROOT, "data", f);
	if (fs.existsSync(p)) console.log(`data/${f}: ${fs.statSync(p).size} B`);
}
