/*
 * survey-markup.js
 * ================
 *
 * WHAT THIS SCRIPT DOES
 * ---------------------
 * The text in data/ is not plain English. It carries 5etools' own markup
 * ({@damage 8d6}, {@condition prone}, ...) and its `entries` arrays mix
 * strings with nested objects that each have a `type`.
 *
 * Before writing a renderer we need to know exactly what is in there —
 * not what the examples in NOTES.md happen to mention. This script walks
 * every JSON file in data/ and reports:
 *
 *   1. Every {@tag} that actually occurs, how often, and in which files
 *   2. The argument shapes each tag is used with (how many |-separated
 *      parts) plus real examples
 *   3. Every `type` value found on a nested entry object, how often, and
 *      which other keys that object carries
 *
 * It writes MARKUP-INVENTORY.md at the repo root.
 *
 * HOW TO RUN IT
 * -------------
 *     npm run survey-markup
 *
 * Re-run it after any change to extract-data.js. If the renderer's tag
 * table and this inventory ever disagree, the inventory is right.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const OUTPUT_FILE = path.join(ROOT, "docs", "MARKUP-INVENTORY.md");

// How many real examples to keep per tag / per entry type.
const MAX_EXAMPLES = 4;

// Keys whose contents are entry structures. Once the walk descends through
// one of these, every object below it counts as an "entry object" and its
// `type` is inventoried. Without this gate we would also count the `type`
// field on items ("M|XPHB"), which is an item-category code, not an entry
// type — a completely different thing that happens to share the name.
const ENTRY_KEYS = new Set([
	"entries",
	"entriesHigherLevel",
	"items",
	"rows",
	"footnotes",
	"fluff",
	"headerEntries",
]);

/* ============================================================================
 * SECTION 1 — FINDING TAGS IN A STRING
 * ==========================================================================*/

/*
 * Pulls out every {@tag ...} in a string, including nested ones.
 *
 * A regex cannot do this alone: tags nest, e.g.
 *   {@item Wand of Magic Missiles|XDMG|a {@spell magic missile} wand}
 * so we scan character by character and track brace depth.
 *
 * Returns [{ name, raw, body, depth }], where `body` is everything after
 * the tag name and `depth` is 0 for a top-level tag, 1 for one nested
 * inside it, and so on.
 */
function findTags(text, depth = 0, out = []) {
	for (let i = 0; i < text.length; i++) {
		if (text[i] !== "{" || text[i + 1] !== "@") continue;

		// Walk forward to the matching close brace.
		let braceDepth = 0;
		let end = -1;
		for (let j = i; j < text.length; j++) {
			if (text[j] === "{") braceDepth++;
			else if (text[j] === "}") {
				braceDepth--;
				if (braceDepth === 0) {
					end = j;
					break;
				}
			}
		}
		if (end === -1) continue; // unbalanced; ignore

		const raw = text.slice(i, end + 1);
		const inner = raw.slice(2, -1); // strip "{@" and "}"
		const spaceAt = inner.search(/\s/);
		const name = spaceAt === -1 ? inner : inner.slice(0, spaceAt);
		const body = spaceAt === -1 ? "" : inner.slice(spaceAt + 1);

		out.push({ name, raw, body, depth });

		// Recurse into the body to catch nested tags.
		findTags(body, depth + 1, out);

		i = end; // continue scanning after this tag
	}
	return out;
}

/*
 * Splits a tag body on "|" but ignores pipes that sit inside a nested tag,
 * so {@item x|{@spell a|b}} counts as 2 parts, not 3.
 */
function splitTopLevelPipes(body) {
	const parts = [];
	let current = "";
	let depth = 0;
	for (const char of body) {
		if (char === "{") depth++;
		else if (char === "}") depth--;

		if (char === "|" && depth === 0) {
			parts.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	parts.push(current);
	return parts;
}

/* ============================================================================
 * SECTION 2 — WALKING THE DATA
 * ==========================================================================*/

const tagStats = new Map(); // name -> { count, files:Set, arities:Map, examples:[], nestedIn:Set, containsNested:count }
const typeStats = new Map(); // type -> { count, files:Set, keys:Map, examples:[] }
let stringCount = 0;
let taggedStringCount = 0;

function recordTag(tag, file) {
	let stat = tagStats.get(tag.name);
	if (!stat) {
		stat = {
			count: 0,
			files: new Set(),
			arities: new Map(),
			examples: [],
			nestedCount: 0,
			hasNestedChild: 0,
		};
		tagStats.set(tag.name, stat);
	}
	stat.count++;
	stat.files.add(file);
	if (tag.depth > 0) stat.nestedCount++;
	if (tag.body.includes("{@")) stat.hasNestedChild++;

	const arity = splitTopLevelPipes(tag.body).length;
	stat.arities.set(arity, (stat.arities.get(arity) ?? 0) + 1);

	if (stat.examples.length < MAX_EXAMPLES && !stat.examples.includes(tag.raw)) {
		stat.examples.push(tag.raw);
	}
}

function recordType(obj, file) {
	const type = obj.type;
	let stat = typeStats.get(type);
	if (!stat) {
		stat = { count: 0, files: new Set(), keys: new Map(), examples: [] };
		typeStats.set(type, stat);
	}
	stat.count++;
	stat.files.add(file);
	for (const key of Object.keys(obj)) {
		if (key === "type") continue;
		stat.keys.set(key, (stat.keys.get(key) ?? 0) + 1);
	}
	if (stat.examples.length < MAX_EXAMPLES) {
		let preview = JSON.stringify(obj);
		if (preview.length > 220) preview = preview.slice(0, 220) + "…";
		stat.examples.push(preview);
	}
}

/*
 * `inEntries` becomes true as soon as we pass through a key from
 * ENTRY_KEYS, and stays true for everything below.
 */
function walk(node, file, inEntries) {
	if (typeof node === "string") {
		stringCount++;
		const tags = findTags(node);
		if (tags.length > 0) taggedStringCount++;
		for (const tag of tags) recordTag(tag, file);
		return;
	}

	if (Array.isArray(node)) {
		for (const child of node) walk(child, file, inEntries);
		return;
	}

	if (node && typeof node === "object") {
		if (inEntries && typeof node.type === "string") {
			recordType(node, file);
		}
		for (const [key, value] of Object.entries(node)) {
			walk(value, file, inEntries || ENTRY_KEYS.has(key));
		}
	}
}

/* ============================================================================
 * SECTION 3 — REPORT
 * ==========================================================================*/

function formatArities(arities) {
	return [...arities.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([n, count]) => `${n} part${n === 1 ? "" : "s"} ×${count}`)
		.join(", ");
}

function main() {
	const files = fs
		.readdirSync(DATA_DIR)
		.filter((name) => name.endsWith(".json"))
		.sort();

	for (const name of files) {
		const parsed = JSON.parse(
			fs.readFileSync(path.join(DATA_DIR, name), "utf8"),
		);
		walk(parsed, name, false);
	}

	const tags = [...tagStats.entries()].sort((a, b) => b[1].count - a[1].count);
	const types = [...typeStats.entries()].sort((a, b) => b[1].count - a[1].count);
	const totalTags = tags.reduce((sum, [, s]) => sum + s.count, 0);

	const md = [];
	md.push("# 5etools markup inventory");
	md.push("");
	md.push(
		"Generated by `npm run survey-markup` (scripts/survey-markup.js).",
		"Do not edit by hand — re-run the script instead.",
		"",
		"This is the authoritative list of what the renderer must handle.",
		"The examples in DATA.md are illustrative only; this is exhaustive.",
		"",
	);
	md.push("## Totals");
	md.push("");
	md.push(`- Files scanned: **${files.length}**`);
	md.push(`- Strings walked: **${stringCount.toLocaleString("en-US")}**`);
	md.push(
		`- Strings containing markup: **${taggedStringCount.toLocaleString("en-US")}**`,
	);
	md.push(`- Tag occurrences: **${totalTags.toLocaleString("en-US")}**`);
	md.push(`- Distinct tag names: **${tags.length}**`);
	md.push(`- Distinct nested entry types: **${types.length}**`);
	md.push("");

	md.push("## Tags by frequency");
	md.push("");
	md.push("| Tag | Count | Files | Arg shapes | Nested inside another tag | Contains a nested tag |");
	md.push("| --- | ---: | ---: | --- | ---: | ---: |");
	for (const [name, stat] of tags) {
		md.push(
			`| \`{@${name}}\` | ${stat.count} | ${stat.files.size} | ${formatArities(stat.arities)} | ${stat.nestedCount} | ${stat.hasNestedChild} |`,
		);
	}
	md.push("");

	md.push("## Tag examples");
	md.push("");
	for (const [name, stat] of tags) {
		md.push(`### \`{@${name}}\` — ${stat.count}`);
		md.push("");
		md.push(`Files: ${[...stat.files].sort().join(", ")}`);
		md.push("");
		md.push("```");
		for (const example of stat.examples) md.push(example);
		md.push("```");
		md.push("");
	}

	md.push("## Nested entry object types");
	md.push("");
	md.push("| `type` | Count | Files | Keys seen (count) |");
	md.push("| --- | ---: | ---: | --- |");
	for (const [type, stat] of types) {
		const keys = [...stat.keys.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([key, count]) => `\`${key}\` ${count}`)
			.join(", ");
		md.push(`| \`${type}\` | ${stat.count} | ${stat.files.size} | ${keys} |`);
	}
	md.push("");

	md.push("## Entry type examples");
	md.push("");
	for (const [type, stat] of types) {
		md.push(`### \`${type}\` — ${stat.count}`);
		md.push("");
		md.push("```json");
		for (const example of stat.examples) md.push(example);
		md.push("```");
		md.push("");
	}

	fs.writeFileSync(OUTPUT_FILE, md.join("\n"), "utf8");

	console.log(`survey-markup: ${totalTags} tag occurrences, ${tags.length} distinct tags`);
	console.log(`survey-markup: ${types.length} distinct nested entry types`);
	console.log(`survey-markup: wrote ${path.relative(ROOT, OUTPUT_FILE)}`);
}

main();
