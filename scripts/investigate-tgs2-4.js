// P-TGS2-4 investigation: spells, ki, Channel Divinity and 2014 terms in the extracted TGS2 records (data/).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data");
const load = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
const mode = process.argv[2] || "sentences";
const SRC = "GriffonsSaddlebag2";
const cut = (s, n = 300) => (s.length > n ? s.slice(0, n) + "…" : s);
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

const strip = (s) => s.replace(/\{@(\w+)\s+([^}]*)\}/g, (_, tag, body) => {
	const args = body.split("|");
	const idx = { subclassFeature: 7, classFeature: 5, subclass: 4 }[tag] ?? 2;
	return (["dice", "damage", "d20", "b", "i", "note", "chance", "filter"].includes(tag) ? args[0] : args[idx] || args[0]);
});
function walkStrings(node, cb) {
	if (typeof node === "string") cb(node);
	else if (Array.isArray(node)) node.forEach((n) => walkStrings(n, cb));
	else if (isRecord(node)) Object.values(node).forEach((n) => walkStrings(n, cb));
}
const sentences = (entries) => {
	const out = [];
	walkStrings(entries, (s) => out.push(...s.split(/(?<=[.!?])\s+(?=[A-Z{])/)));
	return out;
};

const features = load("subclass-features.json").filter((f) => f.subclassSource === SRC || f.source === SRC);
const species = load("species.json").filter((s) => s.source === SRC);
const label = (f) => `${f.subclassShortName} L${f.level} ${f.name}`;

if (mode === "sentences") {
	console.log(`features ${features.length}, species ${species.length}, feature keys: ${[...new Set(features.flatMap(Object.keys))].join(",")}`);
	const groups = {
		SPELL: (raw) => /\{@spell /.test(raw) || /\bcast\b/i.test(strip(raw)),
		KI: (raw) => /\bki\b/i.test(raw),
		TERM2014: (raw) => /grappl|Use an Object|Hit Di(c)?e|Attack action|\bcheck\b/i.test(raw),
		CD: (raw) => /Channel Divinity/i.test(raw),
	};
	for (const [g, test] of Object.entries(groups)) {
		console.log(`\n== ${g}`);
		for (const f of [...features, ...species.map((s) => ({ ...s, subclassShortName: "SPECIES", level: 0 }))]) {
			for (const raw of sentences(f.entries)) if (test(raw)) console.log(`${label(f)}: ${cut(strip(raw))}`);
		}
	}
}

if (mode === "feature") {
	for (const name of process.argv.slice(3)) {
		const f = features.find((x) => x.name === name);
		if (!f) { console.log(`${name}: not found`); continue; }
		console.log(`== ${label(f)}`);
		for (const s of sentences(f.entries)) console.log(`   ${cut(strip(s), 220)}`);
	}
}

if (mode === "monkdc") {
	const cf = load("class-features.json").filter((f) => f.className === "Monk" && f.source === "XPHB");
	for (const f of cf) for (const s of sentences(f.entries)) if (/save DC|saving throw DC|Focus Point/i.test(s) && /DC/.test(s)) console.log(`${f.name} L${f.level}: ${cut(strip(s), 200)}`);
}

if (mode === "targets") {
	console.log("data files:", fs.readdirSync(DATA).join(","));
	const actions = load("actions.json");
	console.log("actions XPHB matching utiliz|grapple|object:", actions.filter((a) => /utiliz|grapple|object/i.test(a.name)).map((a) => `${a.name}|${a.source}`).join("; ") || "none");
	const vrFile = "rules.json";
	if (vrFile) console.log(`${vrFile} unarmed/grapple/hit point dice:`, Object.values(load(vrFile)).flat().filter((v) => v && v.name).filter((v) => /unarmed strike|grappl|hit point dice/i.test(v.name)).map((v) => `${v.name}|${v.source}`).join("; ") || "none");
	const tags = new Set();
	for (const f of features) walkStrings(f.entries, (s) => { for (const m of s.matchAll(/\{@variantrule ([^}]+)\}/g)) tags.add(m[1]); });
	console.log("variantrule tags in TGS2 features:", [...tags].join("; "));
}

if (mode === "subclass") {
	const classes = load("classes.json");
	for (const s of classes.filter((c) => c.source === SRC && c.additionalSpells)) console.log(`${s.shortName}: ${cut(JSON.stringify(s.additionalSpells), 400)}`);
	console.log("feature records with additionalSpells/consumes:", features.filter((f) => f.additionalSpells || f.consumes).map(label).join("; ") || "none");
}

if (mode === "shapes") {
	const classes = load("classes.json").filter((c) => c.additionalSpells && c.source !== SRC && (c.className || c.entryType === "subclass"));
	const shapes = new Map();
	const add = (k, who) => { if (!shapes.has(k)) shapes.set(k, []); shapes.get(k).push(who); };
	for (const s of classes) {
		const who = `${s.className ?? ""}/${s.shortName ?? s.name}|${s.source}`;
		for (const entry of s.additionalSpells) {
			for (const key of ["prepared", "known", "innate", "expanded"]) {
				if (!isRecord(entry[key])) continue;
				for (const v of Object.values(entry[key])) {
					if (Array.isArray(v)) add(`${key}.bare${v.some(isRecord) ? "+choose" : ""}`, who);
					else if (isRecord(v)) for (const [w, wv] of Object.entries(v)) add(`${key}.${w}${isRecord(wv) ? `{${Object.keys(wv).join(",")}}` : ""}${entry.resourceName ? ` resourceName=${entry.resourceName}` : ""}`, who);
				}
			}
		}
	}
	for (const [k, list] of [...shapes].sort()) { const u = [...new Set(list)]; console.log(`${k}: ${u.length} subclasses, e.g. ${u.slice(0, 3).join("; ")}`); }
}

if (mode === "cd") {
	const all = load("subclass-features.json").filter((f) => f.className === "Paladin" && ["XPHB", "XGE", "TCE", SRC].includes(f.subclassSource));
	const cd = all.filter((f) => f.consumes || /Channel Divinity/i.test(f.name) || /Channel Divinity/.test(JSON.stringify(f.entries)));
	const bySrc = {};
	for (const f of cd) {
		const k = `${f.subclassSource}|consumes=${f.consumes ? JSON.stringify(f.consumes) : "none"}|nameHasCD=${/Channel Divinity/i.test(f.name)}`;
		(bySrc[k] = bySrc[k] || []).push(`${f.subclassShortName}:${f.name}`);
	}
	for (const [k, v] of Object.entries(bySrc)) console.log(`${k}: ${v.length}, e.g. ${v.slice(0, 3).join("; ")}`);
	const xge = all.find((f) => f.subclassSource === "XGE" && f.name === "Channel Divinity");
	if (xge) console.log("XGE 'Channel Divinity' entries shape:", cut(JSON.stringify(xge.entries.map((e) => (isRecord(e) ? { type: e.type, name: e.name, ref: e.subclassFeature } : "str"))), 400));
	for (const f of features.filter((f) => f.subclassShortName === "Spelldrinker")) console.log(`SD L${f.level} ${f.name} header=${f.header ?? "-"} consumes=${f.consumes ? JSON.stringify(f.consumes) : "none"} entryTypes=${(f.entries || []).map((e) => (isRecord(e) ? `${e.type}:${e.name ?? ""}` : "str")).join(",")}`);
	const classes = load("classes.json");
	const pal = classes.find((c) => c.name === "Paladin" && c.source === "XPHB" && c.entryType !== "subclass");
	if (pal) console.log("Paladin XPHB table cols:", JSON.stringify((pal.classTableGroups || []).map((g) => g.colLabels)));
}

if (mode === "markup") {
	const tagsTs = fs.readFileSync(path.join(ROOT, "src", "markup", "tags.ts"), "utf8");
	const known = new Set();
	for (const obj of ["REFERENCE_TAGS", "EMPHASIS_TAGS", "VALUE_TAGS", "LABEL_TAGS"]) {
		const body = tagsTs.split(`const ${obj}`)[1].split("\n}\n")[0];
		for (const m of body.matchAll(/^\t'?([\w]+)'?:/gm)) known.add(m[1]);
	}
	const markupTsx = fs.readFileSync(path.join(ROOT, "src", "markup", "Markup.tsx"), "utf8");
	const knownTypes = new Set([...markupTsx.matchAll(/case '(\w+)'/g)].map((m) => m[1]));
	const pools = { spell: load("spells.json"), condition: load("conditions.json"), action: load("actions.json"), item: load("items.json") };
	const unknownTags = new Map(), missing = new Map(), types = new Map(), raw = [];
	const recs = [...features.map((f) => [label(f), f]), ...species.map((s) => [`SPECIES ${s.name}`, s])];
	for (const [who, r] of recs) {
		walkStrings(r.entries, (s) => {
			for (const m of s.matchAll(/\{@(\w+)\s*([^}]*)\}/g)) {
				const [, tag, body] = m;
				if (!known.has(tag)) unknownTags.set(`${tag} ${body}`, who);
				const pool = pools[tag];
				if (pool) {
					const [name, src = ""] = body.split("|");
					const hit = pool.some((e) => e.name.toLowerCase() === name.toLowerCase() && (!src || e.source.toLowerCase() === src.toLowerCase()));
					const xphb = pool.some((e) => e.name.toLowerCase() === name.toLowerCase() && e.source === "XPHB");
					if (!hit || (!src && !xphb)) missing.set(`${tag} ${body}`, `${who} (anySrc=${hit} xphb=${xphb})`);
				}
			}
			if (/\{@|\{=|\{#|\}\}/.test(s.replace(/\{@\w+\s*[^}]*\}/g, ""))) raw.push(`${who}: ${cut(s, 120)}`);
		});
		const walkTypes = (n) => { if (Array.isArray(n)) n.forEach(walkTypes); else if (isRecord(n)) { if (n.type) { const t = types.get(n.type) || { c: 0, who }; t.c++; types.set(n.type, t); } Object.values(n).forEach(walkTypes); } };
		walkTypes(r.entries);
	}
	console.log("known tag names:", known.size, "markup entry types:", knownTypes.size);
	console.log("unknown tags:", [...unknownTags].map(([k, w]) => `${k} @${w}`).join("; ") || "none");
	console.log("reference tags without data target (or untagged source lacking XPHB):", [...missing].map(([k, w]) => `${k} @${w}`).join("; ") || "none");
	console.log("entry types:", [...types].map(([t, v]) => `${t}(${v.c})${knownTypes.has(t) ? "" : " UNHANDLED@" + v.who}`).join(", "));
	console.log("leftover braces:", raw.length, raw.slice(0, 3).join(" | "));
	const tagCount = {};
	for (const [, r] of recs) walkStrings(r.entries, (s) => { for (const m of s.matchAll(/\{@(\w+)/g)) tagCount[m[1]] = (tagCount[m[1]] || 0) + 1; });
	console.log("tag counts:", JSON.stringify(tagCount));
}
