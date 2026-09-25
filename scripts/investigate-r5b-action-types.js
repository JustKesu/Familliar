/*
 * Investigation for sheet rework slice R5b. Prints a SUMMARY only; writes nothing.
 * Can features in the actions table be grouped Action / Bonus Action / Reaction /
 * Other from their activation tags? isActionTableFeature (D86) is re-implemented
 * here identically to src/actions/actionTableFeatureData.ts (TS is not importable
 * from a CommonJS script).
 */
const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));

// ---- D86, identical to actionTableFeatureData.ts ----
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const REST_TAG = /\{@variantrule\s+(Long Rest|Short Rest)\b/i;
function nodeBody(node) {
	if (Array.isArray(node.entries)) return node.entries;
	if (node.entry !== undefined) return [node.entry];
	return [];
}
function hasRestTag(node) {
	if (typeof node === "string") return REST_TAG.test(node);
	if (Array.isArray(node)) return node.some(hasRestTag);
	if (!isRecord(node)) return false;
	if (hasRestTag(nodeBody(node))) return true;
	if (hasRestTag(node.items)) return true;
	if (hasRestTag(node.rows)) return true;
	if (isRecord(node.row) && hasRestTag(node.row.row)) return true;
	return false;
}
function isActionTableFeature(f) {
	if (!isRecord(f)) return false;
	if (f.consumes !== undefined) return true;
	return hasRestTag(f.entries);
}

// ---- string leaves in document order, same walk shape as hasRestTag ----
function leaves(node, nested, out) {
	if (typeof node === "string") out.push({ text: node, nested });
	else if (Array.isArray(node)) for (const n of node) leaves(n, nested, out);
	else if (isRecord(node)) {
		leaves(nodeBody(node), true, out);
		leaves(node.items, true, out);
		leaves(node.rows, true, out);
		if (isRecord(node.row)) leaves(node.row.row, true, out);
	}
	return out;
}
function textLeaves(f) {
	const out = [];
	for (const e of f.entries || []) leaves(e, typeof e !== "string", out);
	return out;
}
// End of first sentence: first . ! ? outside {…} followed by whitespace/end.
function firstSentenceEnd(s) {
	let depth = 0;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "{") depth++;
		else if (c === "}") depth = Math.max(0, depth - 1);
		else if (depth === 0 && ".!?".includes(c) && (i + 1 === s.length || /\s/.test(s[i + 1]))) return i + 1;
	}
	return s.length;
}
const strip = (s) => s.replace(/\{@\w+\s+([^}]*)\}/g, (_, b) => { const p = b.split("|"); return p.length >= 3 && p[2] ? p[2] : p[0]; });
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const TAG = /\{@(variantrule|action)\s+([^|}]+)[^}]*\}/gi;
function tagKind(type, name) {
	name = name.trim();
	if (type.toLowerCase() === "action") return "A";
	if (/^bonus action$/i.test(name)) return "BA";
	if (/^reaction$/i.test(name)) return "R";
	if (/^action$/i.test(name)) return "A";
	return null;
}

// R-phrase frames. A match preceded by a trigger ("when you …") is skipped.
// BA/R: "as a / take a / use your … {@variantrule Bonus Action|Reaction}" — "its" left out (another creature's Reaction).
// A: "take the / as a {@action X} action", unless it continues "as a Bonus Action/Reaction" (then the BA/R frame wins).
const LEAD_IN = String.raw`\b(?:as|use|take|takes|taking|using|spend)\s+(?:a|an|your|one)\s+`;
const FRAMES = [
	{ kind: "BA", re: new RegExp(LEAD_IN + String.raw`\{@variantrule Bonus Action\b`, "gi") },
	{ kind: "R", re: new RegExp(LEAD_IN + String.raw`\{@variantrule Reaction\b`, "gi") },
	{ kind: "A", re: /\b(?:as|take|takes|taking|use)\s+(?:the|a|an|one)\s+\{@action [^}]+\}\s+actions?(?!\s+(?:as|using)\s+(?:a|an|your)\s+\{@variantrule (?:Bonus Action|Reaction)\b)/gi },
	{ kind: "A", re: /\b(?:take|takes|taking)\s+(?:both\s+)?the\s+\{@action [^}]+\}\s+and\s+(?:the\s+)?\{@action [^}]+\}\s+actions(?!\s+as\s+(?:a|an|your)\s+\{@variantrule (?:Bonus Action|Reaction)\b)/gi },
	{ kind: "O", re: /\(?no action required\)?/gi },
];
const TRIGGER_BEFORE = /\b(?:when|whenever|if|after|once|until|before)\s+(?:you|it|they|the target|a creature)\s+(?:can\s+)?$/i;

function analyse(f) {
	const ls = textLeaves(f);
	const tags = [];
	const frames = [];
	let firstStringSeen = false;
	let firstSentence = "";
	ls.forEach((leaf, li) => {
		const isFirst = !firstStringSeen;
		firstStringSeen = true;
		const end = isFirst ? firstSentenceEnd(leaf.text) : 0;
		if (isFirst) firstSentence = leaf.text.slice(0, end);
		for (const m of leaf.text.matchAll(TAG)) {
			const kind = tagKind(m[1], m[2]);
			if (!kind) continue;
			const where = leaf.nested ? "nested" : isFirst ? (m.index < end ? "lead" : "firstString") : "top";
			tags.push({ kind, name: m[2].trim(), where, li, off: m.index, nestedFirst: isFirst && leaf.nested && m.index < end });
		}
		for (const fr of FRAMES) {
			for (const m of leaf.text.matchAll(fr.re)) {
				if (TRIGGER_BEFORE.test(leaf.text.slice(Math.max(0, m.index - 40), m.index))) continue;
				frames.push({ kind: fr.kind, li, off: m.index });
			}
		}
	});
	frames.sort((a, b) => a.li - b.li || a.off - b.off);
	const G = { A: "Action", BA: "Bonus", R: "Reaction", O: "Other" };
	// "lead" = first sentence of the first string leaf, even if that leaf is nested (flagged).
	const leadTags = tags.filter((t) => t.where === "lead" || t.nestedFirst);
	const firstStringTags = tags.filter((t) => t.li === 0);
	return {
		tags,
		firstSentence,
		firstLeafNested: ls.length > 0 && ls[0].nested,
		"R-first": tags.length ? G[tags[0].kind] : "Other",
		"R-lead": leadTags.length ? G[leadTags[0].kind] : "Other",
		"R-phrase": frames.length ? G[frames[0].kind] : "Other",
		"R-lead1str": firstStringTags.length ? G[firstStringTags[0].kind] : "Other",
		"R-phrase1str": (() => { const x = frames.filter((fr) => fr.li === 0); return x.length ? G[x[0].kind] : "Other"; })(),
	};
}
const RULES = ["R-first", "R-lead", "R-phrase", "R-lead1str", "R-phrase1str"];
const CORE_RULES = ["R-first", "R-lead", "R-phrase"];
const GROUPS = ["Action", "Bonus", "Reaction", "Other"];

// ---- load ----
const files = {
	"class-features": readJson("class-features.json"),
	"subclass-features": readJson("subclass-features.json"),
	feats: readJson("feats.json"),
	"optional-features": readJson("optional-features.json"),
};
const all = [];
for (const [file, recs] of Object.entries(files)) {
	for (const r of recs) {
		if (!isActionTableFeature(r)) continue;
		all.push({ file, name: r.name, source: r.source, featureType: r.featureType, rec: r, a: analyse(r) });
	}
}

console.log("Q0  IN SCOPE (isActionTableFeature, records): " + Object.keys(files).map((f) => `${f} ${all.filter((x) => x.file === f).length}/${files[f].length}`).join(" · "));
const sources = {};
for (const x of all) sources[x.source] = (sources[x.source] || 0) + 1;
console.log("    by source: " + Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(", "));

// ---- Q1 inventory ----
console.log("\nQ1  TAG INVENTORY (records with ≥1 tag of kind; kinds A=@action/variantrule Action, BA, R)");
const names = {};
for (const x of all) for (const t of x.a.tags) names[`${t.kind}:${t.name}`] = (names[`${t.kind}:${t.name}`] || 0) + 1;
console.log("    tag names (occurrences): " + Object.entries(names).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", "));
for (const f of Object.keys(files)) {
	const xs = all.filter((x) => x.file === f);
	const row = ["A", "BA", "R"].map((k) => {
		const w = { lead: 0, firstString: 0, top: 0, nested: 0 };
		let recs = 0;
		for (const x of xs) {
			const ts = x.a.tags.filter((t) => t.kind === k);
			if (ts.length) recs++;
			for (const t of ts) w[t.where]++;
		}
		return `${k}: ${recs} recs (occ lead ${w.lead}/1st-str ${w.firstString}/top ${w.top}/nested ${w.nested})`;
	});
	const none = xs.filter((x) => !x.a.tags.length).length;
	const nestedFirst = xs.filter((x) => x.a.firstLeafNested).length;
	console.log(`    ${f} (${xs.length}): ${row.join(" · ")} · no tag ${none} · first string nested ${nestedFirst}`);
}
const orders = {};
for (const x of all) {
	const seq = x.a.tags.map((t) => t.kind).filter((k, i, a) => i === 0 || a[i - 1] !== k).join(">") || "(none)";
	orders[seq] = (orders[seq] || 0) + 1;
}
console.log("    order patterns (consecutive repeats collapsed): " + Object.entries(orders).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${n}`).join(", "));
const untagged = all.filter((x) => !x.a.tags.length && /\b(bonus action|reaction|as an action|magic action)\b/i.test(strip(textLeaves(x.rec).map((l) => l.text).join(" "))));
console.log(`    no activation tag but stripped prose says bonus action/reaction/as an action/magic action: ${untagged.length} (sources ${[...new Set(untagged.map((x) => x.source))].join(",")}); e.g. ${untagged.slice(0, 3).map((x) => `${x.name}|${x.source}`).join("; ")}`);

// ---- Q2 counts ----
console.log("\nQ2  RULE RESULTS (records) — Action / Bonus / Reaction / Other");
for (const r of RULES) {
	const per = Object.keys(files).map((f) => {
		const xs = all.filter((x) => x.file === f);
		return `${f} ${GROUPS.map((g) => xs.filter((x) => x.a[r] === g).length).join("/")}`;
	});
	console.log(`    ${r.padEnd(12)} total ${GROUPS.map((g) => all.filter((x) => x.a[r] === g).length).join("/")} · ${per.join(" · ")}`);
}

// ---- Q3 hand list ----
console.log("\nQ3  HAND LIST (XPHB record preferred; OUT = not in scope, answers shown anyway)");
const everyRec = Object.entries(files).flatMap(([file, recs]) => recs.map((r) => ({ file, r })));
const hand = [
	["Rage", "Bonus"], ["Second Wind", "Bonus"], ["Action Surge", "Other"], ["Cunning Action", "Bonus"],
	["Uncanny Dodge", "Reaction"], ["Channel Divinity", "Action"], ["Wild Shape", "Bonus"], ["Lay On Hands", "Bonus"],
	["Bardic Inspiration", "Bonus"], ["Flurry of Blows", "Bonus"], ["Patient Defense", "Bonus"], ["Step of the Wind", "Bonus"],
	["Deflect Attacks", "Reaction"], ["Font of Magic", "Other"], ["Stunning Strike", "Other"], ["Divine Sense", "Bonus"],
	["Arcane Recovery", "Other"], ["Indomitable", "Other"], ["Relentless Rage", "Other"], ["Tactical Mind", "Other"],
	["Riposte", "Reaction"], ["Parry", "Reaction"], ["Commanding Presence", "Other"],
];
const hits = Object.fromEntries(RULES.map((r) => [r, 0]));
let denom = 0;
for (const [name, want] of hand) {
	const cands = everyRec.filter((x) => x.r.name.toLowerCase() === name.toLowerCase());
	if (!cands.length) { console.log(`    ${name}: NOT IN DATA`); continue; }
	const pick = cands.find((x) => x.r.source === "XPHB") || cands[0];
	const inScope = isActionTableFeature(pick.r);
	const a = analyse(pick.r);
	if (inScope) { denom++; for (const r of RULES) if (a[r] === want) hits[r]++; }
	const other = cands.length > 1 ? ` (+${cands.length - 1} other recs: ${[...new Set(cands.filter((c) => c !== pick).map((c) => c.r.source))].join(",")})` : "";
	console.log(`    ${inScope ? "IN " : "OUT"} ${name}|${pick.r.source} ${pick.r.className || ""} [${pick.file}] want ${want}: ${RULES.map((r) => `${r}=${a[r]}${a[r] === want ? "" : "✗"}`).join(" ")}${other}`);
	if (name === "Channel Divinity") channelDivinityDetail(cands);
}
function channelDivinityDetail(cands) {
	for (const c of cands.filter((x) => x.r.source === "XPHB")) {
		const ca = analyse(c.r);
		const kinds = (c.r.entries || []).map((e) => (typeof e === "string" ? "str" : e.type)).join(",");
		const json = JSON.stringify(c.r);
		const last = c.r.entries[c.r.entries.length - 1];
		console.log(`      ${c.r.className} ${c.r.level} in=${isActionTableFeature(c.r)} entries[${kinds}] tags ${ca.tags.map((t) => t.kind + ":" + t.name).join(",") || "none"} P=${ca["R-phrase"]} · raw JSON has "@action" ${json.includes("@action")}, "Magic" ${/magic action/i.test(strip(json))} · last block keys ${Object.keys(last).join(",")} name=${last.name} inner types ${(last.entries || []).map((e) => (typeof e === "string" ? "str" : e.type)).join(",")}`);
	}
	for (const n of ["Divine Spark", "Turn Undead", "Channel Divinity: Divine Spark", "Channel Divinity: Turn Undead"]) {
		for (const x of everyRec.filter((y) => y.r.name === n && y.r.source === "XPHB")) { const xa = analyse(x.r); console.log(`      separate record ${n}|XPHB [${x.file}] in=${isActionTableFeature(x.r)} ${CORE_RULES.map((r) => `${r}=${xa[r]}`).join(" ")}`); }
	}
}
// Metamagic as one hand item: hit only if every in-scope XPHB metamagic option gets Other.
const mm = all.filter((x) => x.file === "optional-features" && (x.featureType || []).includes("MM"));
const mmX = mm.filter((x) => x.source === "XPHB");
const mmSet = mmX.length ? mmX : mm;
denom++;
for (const r of RULES) if (mmSet.every((x) => x.a[r] === "Other")) hits[r]++;
console.log(`    IN  Metamagic (${mmSet.length} in-scope ${mmX.length ? "XPHB" : "any-source"} options) want Other: ${RULES.map((r) => `${r}=${mmSet.filter((x) => x.a[r] === "Other").length}/${mmSet.length}`).join(" ")}; non-Other under R-first: ${mmSet.filter((x) => x.a["R-first"] !== "Other").map((x) => `${x.name}=${x.a["R-first"]}`).join(", ") || "none"}`);
console.log(`    HIT RATE over ${denom} in-scope items: ${RULES.map((r) => `${r} ${hits[r]}/${denom} (${Math.round((100 * hits[r]) / denom)}%)`).join(" · ")}`);
for (const fname of ["Sentinel", "Shield Master", "War Caster", "Mage Slayer", "Polearm Master", "Crossbow Expert", "Defensive Duelist", "Charger"]) {
	const cs = files.feats.filter((r) => r.name === fname);
	if (!cs.length) continue;
	console.log(`    feat ${fname}: ${cs.map((r) => { const a = analyse(r); return `${r.source} ${isActionTableFeature(r) ? "IN" : "OUT"} ${RULES.map((x) => `${x}=${a[x]}`).join(" ")}`; }).join(" | ")}`);
}
const featNonOther = all.filter((x) => x.file === "feats" && x.a["R-phrase"] !== "Other");
console.log(`    in-scope feats not Other under R-phrase: ${featNonOther.length} — ${featNonOther.slice(0, 8).map((x) => `${x.name}|${x.source}=${x.a["R-phrase"]}`).join(", ")}`);

// ---- Q4 disagreements (the three required rules) ----
const CORE = ["R-first", "R-lead", "R-phrase"];
const dis = all.filter((x) => new Set(CORE.map((r) => x.a[r])).size > 1);
const seenKey = new Set();
const disU = dis.filter((x) => { const k = `${x.name}|${x.source}`; if (seenKey.has(k)) return false; seenKey.add(k); return true; });
console.log(`\nQ4  DISAGREEMENTS among R-first/R-lead/R-phrase: ${dis.length} records, ${disU.length} distinct name|source (first 60, XPHB first)`);
disU.sort((a, b) => (b.source === "XPHB") - (a.source === "XPHB") || a.file.localeCompare(b.file));
for (const x of disU.slice(0, 60)) console.log(`    ${trunc(x.name, 28)}|${x.source} ${x.file.split("-")[0]} F=${x.a["R-first"]} L=${x.a["R-lead"]} P=${x.a["R-phrase"]} :: ${trunc(strip(x.a.firstSentence), 80)}`);

// ---- Q5 spells ----
const spells = readJson("spells.json");
const units = {};
let twoTimes = 0, reactCond = 0, reactTotal = 0, noTime = 0;
const pairs = {};
for (const s of spells) {
	if (!Array.isArray(s.time)) { noTime++; continue; }
	if (s.time.length > 1) { twoTimes++; const k = s.time.map((t) => t.unit).join("+"); pairs[k] = (pairs[k] || 0) + 1; }
	for (const t of s.time) {
		units[t.unit] = (units[t.unit] || 0) + 1;
		if (t.unit === "reaction") { reactTotal++; if (typeof t.condition === "string") reactCond++; }
	}
}
const lens = {};
for (const s of spells) if (Array.isArray(s.time)) lens[s.time.length] = (lens[s.time.length] || 0) + 1;
console.log(`\nQ5  SPELLS ${spells.length}: no time array ${noTime}; time lengths ${JSON.stringify(lens)}; units ${Object.entries(units).map(([u, n]) => `${u} ${n}`).join(", ")}`);
console.log(`    reaction time entries ${reactTotal}, with condition text ${reactCond}; multi-entry time ${twoTimes}: ${Object.entries(pairs).map(([k, n]) => `${k} ${n}`).join(", ")} e.g. ${spells.filter((s) => Array.isArray(s.time) && s.time.length > 1).slice(0, 3).map((s) => `${s.name}|${s.source}`).join("; ")}`);

// ---- Q6 species traits ----
const species = readJson("species.json");
const traits = [];
for (const sp of species) for (const e of sp.entries || []) if (isRecord(e) && typeof e.name === "string") traits.push({ name: e.name, source: sp.source, species: sp.name, rec: e });
const tIn = traits.filter((t) => isActionTableFeature(t.rec));
console.log(`\nQ6  SPECIES TRAITS ${traits.length} named, ${tIn.length} pass isActionTableFeature (by source ${Object.entries(tIn.reduce((m, t) => ((m[t.source] = (m[t.source] || 0) + 1), m), {})).map(([s, n]) => `${s} ${n}`).join(", ")})`);
for (const r of CORE) console.log(`    ${r.padEnd(9)} ${GROUPS.map((g) => `${g} ${tIn.filter((t) => analyse(t.rec)[r] === g).length}`).join(" / ")}`);
const tU = new Map();
for (const t of tIn) if (!tU.has(t.name + t.source)) tU.set(t.name + t.source, t);
const pickNames = ["Breath Weapon", "Fey Step", "Healing Hands", "Celestial Revelation", "Stone's Endurance", "Relentless Endurance", "Large Form", "Adrenaline Rush", "Lucky"];
for (const n of pickNames) {
	const t = [...tU.values()].find((x) => x.name === n && x.source === "XPHB") || [...tU.values()].find((x) => x.name === n);
	if (t) { const a = analyse(t.rec); console.log(`    ${n}|${t.source} (${t.species}): ${CORE.map((r) => `${r}=${a[r]}`).join(" ")}`); }
	else console.log(`    ${n}: not among in-scope traits`);
}
const tDis = [...tU.values()].filter((t) => { const a = analyse(t.rec); return new Set(CORE.map((r) => a[r])).size > 1; });
console.log(`    distinct in-scope traits ${tU.size}, rules disagree on ${tDis.length}: ${tDis.slice(0, 8).map((t) => { const a = analyse(t.rec); return `${t.name}|${t.source} F=${a["R-first"]} L=${a["R-lead"]} P=${a["R-phrase"]}`; }).join("; ")}`);
