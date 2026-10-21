// P-TGS2 investigation: prints short summaries of the Griffon's Saddlebag Book 2 homebrew against data/.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HB = JSON.parse(fs.readFileSync(path.join(ROOT, "homebrew", "griffons-saddlebag-2.json"), "utf8"));
const DATA = path.join(ROOT, "data");
const load = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
const mode = process.argv[2] || "overview";
const short = (v, n = 160) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n) + "…" : s; };

const KEEP_SUBCLASSES = [
	["Barbarian", "Infernal"], ["Bard", "Mercantile"], ["Fighter", "Steel Hawk"], ["Monk", "Aether"],
	["Paladin", "Spelldrinker"], ["Ranger", "Rocborne"], ["Rogue", "Grim Surgeon"],
];
const KEEP_RACES = ["Etherean", "Geleton"];

const pickedSubclasses = () => (HB.subclass || []).filter((s) => KEEP_SUBCLASSES.some(([c, n]) => s.className === c && (s.name.includes(n) || s.shortName.includes(n))));
const pickedFeatures = () => {
	const subs = pickedSubclasses();
	return (HB.subclassFeature || []).filter((f) => subs.some((s) => f.className === s.className && f.subclassShortName === s.shortName && f.subclassSource === s.source));
};
const pickedRaces = () => [...(HB.race || []), ...(HB.subrace || [])].filter((r) => KEEP_RACES.some((n) => r.name.includes(n) || (r.raceName || "").includes(n)));

function walkStrings(node, cb) {
	if (typeof node === "string") cb(node);
	else if (Array.isArray(node)) node.forEach((n) => walkStrings(n, cb));
	else if (node && typeof node === "object") Object.values(node).forEach((n) => walkStrings(n, cb));
}

if (mode === "names") {
	for (const s of pickedSubclasses()) console.log(`SUB "${s.name}" short="${s.shortName}" class=${s.className}|${s.classSource} src=${s.source} features=${(s.subclassFeatures || []).length}`);
	console.log("features picked:", pickedFeatures().length, "levels:", pickedFeatures().map((f) => `${f.subclassShortName}:${f.level}`).slice(0, 3).join(","));
	for (const r of pickedRaces()) console.log(`RACE "${r.name}" raceName=${r.raceName ?? "-"} src=${r.source} size=${JSON.stringify(r.size)} ability=${r.ability ? "yes" : "no"}`);
	console.log("subrace list:", (HB.subrace || []).length, " race list:", (HB.race || []).length);
	const sub = pickedSubclasses().find((s) => s.shortName === "Infernal");
	console.log("Infernal refs:", (sub.subclassFeatures || []).map((r) => (typeof r === "string" ? r : r.subclassFeature)).join(" ; "));
	console.log("Infernal L3 records:", pickedFeatures().filter((f) => f.subclassShortName === "Infernal" && f.level === 3).map((f) => f.name).join(" ; "));
	const addl = [];
	for (const s of pickedSubclasses()) walkStrings(s.additionalSpells || [], (x) => addl.push(x));
	console.log("additionalSpells strings:", addl.length, "examples:", addl.slice(0, 3).join(" ; "));
}

if (mode === "overview") {
	console.log("_meta.sources:", short((HB._meta?.sources || []).map((s) => ({ json: s.json, edition: s.edition }))));
	console.log("top-level lists:", Object.keys(HB).filter((k) => Array.isArray(HB[k])).map((k) => `${k}(${HB[k].length})`).join(", "));
	console.log("data/ files:", fs.readdirSync(DATA).join(", "));
	console.log("subclasses:", (HB.subclass || []).map((s) => `${s.className}:${s.shortName}|cs=${s.classSource ?? "-"}|src=${s.source}`).join("; "));
	console.log("races:", (HB.race || []).map((r) => `${r.name}|${r.source}|ed=${r.edition ?? "-"}`).join("; "));
	console.log("subraces:", (HB.subrace || []).map((r) => `${r.name}|${r.raceName}`).join("; "));
	const sf = HB.subclassFeature || [];
	console.log("subclassFeature classSource values:", [...new Set(sf.map((f) => f.classSource ?? "(none)"))].join(","), "subclassSource:", [...new Set(sf.map((f) => f.subclassSource))].join(","));
	const copies = [...(HB.subclass || []), ...sf, ...(HB.race || []), ...(HB.item || [])].filter((e) => e._copy).length;
	console.log("_copy entries:", copies, " _versions:", [...(HB.race || []), ...(HB.item || [])].filter((e) => e._versions).length);
}

if (mode === "fields") {
	for (const s of pickedSubclasses()) {
		console.log(`SUB ${s.className}/${s.shortName} keys=${Object.keys(s).join(",")}`);
		console.log(`   features=${short(s.subclassFeatures, 300)}`);
		if (s.additionalSpells) console.log(`   additionalSpells=${short(s.additionalSpells, 300)}`);
	}
	const fkeys = {};
	for (const f of pickedFeatures()) for (const k of Object.keys(f)) fkeys[k] = (fkeys[k] || 0) + 1;
	console.log("feature keys:", JSON.stringify(fkeys));
	console.log("picked features:", pickedFeatures().length);
	for (const r of pickedRaces()) {
		console.log(`RACE ${r.name}|${r.source} keys=${Object.keys(r).join(",")}`);
		for (const k of ["size", "speed", "ability", "age", "darkvision", "resist", "traitTags", "languageProficiencies", "skillProficiencies", "additionalSpells", "creatureTypes", "lineage", "_versions", "heightAndWeight", "feats"]) {
			if (r[k] !== undefined) console.log(`   ${k}=${short(r[k], 200)}`);
		}
		const names = (r.entries || []).filter((e) => e && e.name).map((e) => e.name);
		console.log(`   entry names=${names.join(" | ")}`);
	}
}

if (mode === "clashes") {
	const classes = load("classes.json");
	const species = load("species.json");
	const sf = load("subclass-features.json");
	for (const s of pickedSubclasses()) {
		const hits = classes.filter((c) => c.entryType === "subclass" && c.className === s.className && (c.name === s.name || c.shortName === s.shortName));
		console.log(`subclass ${s.name}: clash=${hits.map((h) => h.source).join(",") || "none"}`);
	}
	const featNames = new Set(sf.map((f) => `${f.className}|${f.name}`));
	const dupFeat = pickedFeatures().filter((f) => featNames.has(`${f.className}|${f.name}`)).map((f) => `${f.className}:${f.name}`);
	console.log("feature names also in subclass-features.json (same class):", dupFeat.join("; ") || "none");
	for (const r of pickedRaces()) {
		const hits = species.filter((sp) => sp.name === r.name);
		console.log(`race ${r.name}: clash=${hits.map((h) => h.source).join(",") || "none"}`);
	}
	console.log("species size values in data/:", [...new Set(species.flatMap((sp) => sp.size || []))].join(","));
	console.log("species speed shapes in data/:", [...new Set(species.map((sp) => typeof sp.speed === "object" ? Object.keys(sp.speed).sort().join("+") : typeof sp.speed))].join(" ; "));
	console.log("species with ability in data/:", species.filter((sp) => sp.ability).length);
}

if (mode === "tags") {
	const tagRe = /\{@(\w+) ([^}]+)\}/g;
	const found = new Map();
	const scan = (label, node) => walkStrings(node, (s) => {
		const clean = s;
		for (const m of clean.matchAll(tagRe)) {
			const [, tag, body] = m;
			const parts = body.split("|");
			const key = `${tag}|${parts[0].toLowerCase()}|${(parts[1] || "").toUpperCase()}`;
			if (!found.has(key)) found.set(key, { tag, name: parts[0], src: parts[1] || "", where: new Set() });
			found.get(key).where.add(label);
		}
	});
	for (const s of pickedSubclasses()) scan(s.shortName, s);
	for (const f of pickedFeatures()) scan(f.subclassShortName, f);
	for (const r of pickedRaces()) scan(r.name, r);
	const spells = load("spells.json");
	const items = load("items.json");
	const conditions = load("conditions.json");
	const actions = load("actions.json");
	const has = (list, name, src) => list.some((e) => e.name.toLowerCase() === name.toLowerCase() && e.source === src);
	const pools = { spell: spells, item: items, condition: conditions, action: actions };
	const tagCounts = {};
	for (const v of found.values()) tagCounts[v.tag] = (tagCounts[v.tag] || 0) + 1;
	console.log("distinct tags by kind:", JSON.stringify(tagCounts));
	for (const v of [...found.values()].sort((a, b) => a.tag.localeCompare(b.tag) || a.name.localeCompare(b.name))) {
		const src = v.src.toUpperCase();
		if (["DICE", "DAMAGE", "D20", "HIT", "DC", "B", "I", "SCALEDICE", "SCALEDAMAGE", "CHANCE", "RECHARGE", "FILTER", "NOTE", "BOLD", "ITALIC"].includes(v.tag.toUpperCase())) continue;
		const pool = pools[v.tag];
		const xphb = pool ? (has(pool, v.name, "XPHB") ? "XPHB yes" : "XPHB MISS") : "n/a";
		console.log(`${v.tag} | ${v.name} | ${v.src || "(none)"} | ${xphb} | ${[...v.where].join(",")}`);
	}
	const plain = {};
	for (const v of found.values()) if (["dice", "damage", "d20", "hit", "dc", "b", "i", "scaledice", "scaledamage", "chance", "recharge", "filter", "note", "bold", "italic"].includes(v.tag)) plain[v.tag] = (plain[v.tag] || 0) + 1;
	console.log("formatting/dice tags (distinct):", JSON.stringify(plain));
}

if (mode === "mechanics") {
	for (const f of pickedFeatures()) {
		const text = [];
		walkStrings(f.entries, (s) => text.push(s));
		const t = text.join(" ");
		const flags = [];
		const m1 = t.match(/(once|twice|a number of times equal to [^.,]+?|\w+ times)[^.]{0,60}?(short or long rest|long rest|short rest)/i);
		if (m1) flags.push(`uses:"${short(m1[0], 90)}"`);
		if (/ki point/i.test(t)) flags.push("ki");
		if (/hit di(c)?e/i.test(t)) flags.push("HitDice");
		if (/grapple/i.test(t)) flags.push(`grapple:"${short((t.match(/[^.]*grappl[^.]*/i) || [""])[0], 100)}"`);
		if (/\{@damage|\{@dice/.test(t)) flags.push(`dice:${[...t.matchAll(/\{@(?:damage|dice) ([^}]+)\}/g)].map((m) => m[1]).join("/")}`);
		if (/\{@spell/.test(t)) flags.push(`spells:${[...t.matchAll(/\{@spell ([^}|]+)/g)].map((m) => m[1]).join("/")}`);
		if (/bonus action/i.test(t)) flags.push("BA");
		if (/\breaction\b/i.test(t)) flags.push("reaction");
		if (/proficiency bonus/i.test(t)) flags.push("PB");
		if (f.consumes) flags.push(`consumes=${short(f.consumes)}`);
		if (f.additionalSpells) flags.push(`additionalSpells=${short(f.additionalSpells, 120)}`);
		console.log(`${f.subclassShortName} L${f.level} ${f.name}${f.header ? ` (h${f.header})` : ""}: ${flags.join(" ; ") || "-"}`);
	}
}

if (mode === "text") {
	const key = /(rest\b|ki point|channel divinity|hit di|once|times|expend|damage|grappl|saving throw|spell slot|cast)/i;
	for (const f of pickedFeatures()) {
		if (f.header === 1) continue;
		const text = [];
		walkStrings(f.entries, (s) => text.push(s));
		const hits = text.join(" ").split(/(?<=\.)\s+/).filter((s) => key.test(s)).slice(0, 3);
		console.log(`${f.subclassShortName} L${f.level} ${f.name}:`);
		for (const h of hits) console.log(`   ${short(h, 150)}`);
	}
}

if (mode === "racetext") {
	for (const r of pickedRaces()) {
		for (const e of r.entries || []) {
			if (!e || !e.name || ["Age", "Alignment", "Languages", "Speed", "Darkvision"].includes(e.name) || e.name.startsWith("Creating")) continue;
			const text = [];
			walkStrings(e.entries, (s) => text.push(s));
			console.log(`${r.name} / ${e.name}: ${short(text.join(" "), 230)}`);
		}
	}
}

if (mode === "items") {
	const items = HB.item || [];
	const mv = HB.magicvariant || [];
	const base = HB.baseitem || [];
	console.log(`item ${items.length}, magicvariant ${mv.length}, baseitem ${base.length}, itemGroup ${(HB.itemGroup || []).length}`);
	const by = (list, f) => { const o = {}; for (const e of list) { const k = f(e); o[k] = (o[k] || 0) + 1; } return JSON.stringify(o); };
	console.log("item rarity:", by(items, (e) => e.rarity ?? "-"));
	console.log("item type:", by(items, (e) => e.type ?? "-"));
	console.log("item fields seen:", [...new Set(items.flatMap((e) => Object.keys(e)))].join(","));
	console.log("item examples:", items.slice(0, 3).map((e) => `${e.name}|${e.type}|${e.rarity}|attune=${e.reqAttune ?? "-"}`).join("; "));
	console.log("magicvariant examples:", mv.slice(0, 3).map((e) => `${e.name}|requires=${short(e.requires, 60)}|inherits.rarity=${e.inherits?.rarity}`).join("; "));
	const legends = load("items.json");
	const knownTypes = new Set(legends.map((e) => e.type).filter(Boolean));
	console.log("item types not seen in data/items.json:", [...new Set(items.map((e) => e.type).filter((t) => t && !knownTypes.has(t)))].join(",") || "none");
	const clash = items.filter((e) => legends.some((l) => l.name === e.name)).map((e) => e.name);
	console.log("item name clashes with data/items.json:", clash.join("; ") || "none");
	const tagged = new Set();
	walkStrings(items, (s) => { for (const m of s.matchAll(/\{@(\w+) /g)) tagged.add(m[1]); });
	console.log("tag kinds in items:", [...tagged].join(","));
}
