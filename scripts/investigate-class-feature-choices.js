/*
 * investigate-class-feature-choices.js
 * =====================================
 *
 * Build order step 6a, first task (D63): investigation only, per D46 — no
 * picker/storage/wizard/sheet code. Inventories what the data actually
 * contains for selectable "choose N from a list" class/subclass features
 * (Warlock Eldritch Invocations, Fighter Battle Master Maneuvers, and
 * similar), so step 6a can be scoped from facts. Prints a SUMMARY ONLY —
 * counts and at most 3 examples per finding, never whole entries.
 *
 * Answers, in order:
 *   1. CLASS-level optionalfeatureProgression (the known gap — Warlock
 *      Invocations) and whether classTableGroups carries a matching count
 *      column, and whether the two agree.
 *   2. SUBCLASS-level optionalfeatureProgression, for comparison against
 *      the four the existing picker (src/optionalFeatures/) already covers.
 *   3. featureType code inventory across 1+2: how many options each code
 *      resolves to, and whether any resolves to zero.
 *   4. Prerequisite shapes on the resolved option entries, incl. whether
 *      any prerequisite depends on another same-wizard choice.
 *   5. `options`-type nodes inside class-features.json/subclass-features.json
 *      feature text (D21 structured choices no picker currently reads).
 *   6. Structured effect fields on the option entries found in 3 and 5 —
 *      reported only, no decision made here.
 *
 * Run: npm run investigate-class-feature-choices
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(name) {
	return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8"));
}

function truncate(str, max) {
	const s = String(str).replace(/\s+/g, " ");
	return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

function heading(title) {
	console.log("");
	console.log("=".repeat(72));
	console.log(title);
	console.log("=".repeat(72));
}

function findNodesOfType(node, type, results) {
	if (Array.isArray(node)) {
		for (const n of node) findNodesOfType(n, type, results);
	} else if (node && typeof node === "object") {
		if (node.type === type) results.push(node);
		for (const key of Object.keys(node)) findNodesOfType(node[key], type, results);
	}
}

const classes = readJson("classes.json");
const optionalFeatures = readJson("optional-features.json");
const feats = readJson("feats.json");
const classFeatures = readJson("class-features.json");
const subclassFeatures = readJson("subclass-features.json");

const fsFeats = feats.filter((f) => f.category === "FS");

/** Per D12: FS:* codes resolve against feats.json category "FS", suffix ignored; every other code resolves against optional-features.json by exact featureType match. */
function resolveFeatureType(code) {
	if (code.startsWith("FS:")) return fsFeats;
	return optionalFeatures.filter((f) => (f.featureType || []).includes(code));
}

// ---------------------------------------------------------------------
heading("1. CLASS-level optionalfeatureProgression");
// ---------------------------------------------------------------------
{
	const baseClasses = classes.filter((e) => e.entryType === "class");
	console.log(`Base classes in classes.json: ${baseClasses.length}`);
	const withProg = baseClasses.filter((c) => c.optionalfeatureProgression);
	console.log(`Base classes carrying optionalfeatureProgression: ${withProg.length}`);

	for (const c of withProg) {
		for (const prog of c.optionalfeatureProgression) {
			const featureTypes = prog.featureType || [];
			const isArrayShape = Array.isArray(prog.progression);
			console.log(`  ${c.name} (${c.source}) | featureType=${featureTypes.join(",")}`);

			// countAtLevel(level): the count a character of `level` has, given this progression's own shape.
			let countAtLevel;
			if (isArrayShape) {
				// DENSE ARRAY shape (confirmed only on Warlock/EI): index 0 = level 1, cumulative total, one entry per level 1..N.
				const arr = prog.progression;
				console.log(`    progression shape: DENSE ARRAY, 0-indexed by (level-1), ${arr.length} entries -> covers level 1..${arr.length}`);
				console.log(`    first 6 values: ${arr.slice(0, 6).join(", ")}`);
				countAtLevel = (lvl) => (lvl >= 1 && lvl <= arr.length ? arr[lvl - 1] : lvl > arr.length ? arr[arr.length - 1] : 0);
			} else {
				// SPARSE OBJECT shape (confirmed only on Sorcerer/MM, and matches the shape subclass progressions already use): keys are class levels, value holds until the next key.
				const rawProgression = prog.progression || {};
				const levels = Object.keys(rawProgression).map(Number).sort((a, b) => a - b);
				const shape = levels.map((lvl) => `${lvl}:${rawProgression[lvl]}`).join(", ");
				console.log(`    progression shape: SPARSE OBJECT keyed by class level (same shape as subclass optionalfeatureProgression), ${levels.length} steps: ${shape}`);
				countAtLevel = (lvl) => {
					const applicable = levels.filter((l) => l <= lvl);
					return applicable.length === 0 ? 0 : rawProgression[applicable[applicable.length - 1]];
				};
			}
			console.log(`    -> readable STRUCTURALLY: yes (progression gives an exact count per level), but the SHAPE DIFFERS between these two classes — a reader written for one breaks silently on the other (same class of trap as weapon mastery/DATA.md).`);

			// classTableGroups cross-check: does the class table also carry a column with a matching name, and does IT agree with countAtLevel above?
			const groups = c.classTableGroups || [];
			let matchedColumn = null;
			for (const g of groups) {
				const labels = g.colLabels || [];
				const idx = labels.findIndex((l) => /invocation|known|metamagic/i.test(String(l)));
				if (idx !== -1 && g.rows) {
					matchedColumn = { label: labels[idx], colIndex: idx, rows: g.rows };
					break;
				}
			}
			if (matchedColumn) {
				console.log(`    classTableGroups column found: "${matchedColumn.label}"`);
				let agree = true;
				const disagreements = [];
				for (let lvl = 1; lvl <= matchedColumn.rows.length; lvl++) {
					const tableCount = matchedColumn.rows[lvl - 1][matchedColumn.colIndex];
					const progCount = countAtLevel(lvl);
					if (typeof tableCount === "number" && tableCount !== progCount) {
						agree = false;
						if (disagreements.length < 3) disagreements.push(`level ${lvl}: progression=${progCount} table=${tableCount}`);
					}
				}
				console.log(`    table agrees with progression (correctly shape-aware) at every level: ${agree}`);
				if (!agree) console.log(`      disagreements (up to 3): ${disagreements.join(" | ")}`);
			} else {
				console.log(`    classTableGroups column found: none (no column name matching /invocation|known|metamagic/i)`);
			}
		}
	}
}

// ---------------------------------------------------------------------
heading("2. SUBCLASS-level optionalfeatureProgression (comparison)");
// ---------------------------------------------------------------------
{
	const subclasses = classes.filter((e) => e.entryType === "subclass");
	console.log(`Subclass entries in classes.json: ${subclasses.length}`);
	const withProg = subclasses.filter((sc) => sc.optionalfeatureProgression);
	console.log(`Subclasses carrying optionalfeatureProgression: ${withProg.length}`);

	const knownFour = new Set(["Battle Master", "Path of the Rune Knight", "Rune Knight", "Arcane Archer", "College of Swords"]);
	const codeCounts = new Map();
	for (const sc of withProg) {
		for (const prog of sc.optionalfeatureProgression) {
			for (const code of prog.featureType || []) {
				codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
			}
		}
	}
	console.log(`Distinct featureType codes across all subclass progressions: ${[...codeCounts.keys()].join(", ")}`);
	console.log("Full list of subclasses carrying optionalfeatureProgression:");
	for (const sc of withProg) {
		const codes = sc.optionalfeatureProgression.flatMap((p) => p.featureType || []);
		const isKnownFour = codes.some((c) => c.startsWith("MV:") || c === "RN" || c === "AS" || c.startsWith("FS:"));
		console.log(`  ${sc.name} (${sc.className}, ${sc.classSource}/${sc.source}) | codes=${codes.join(",")}${isKnownFour ? "  [existing picker already handles this code]" : "  [NEW — not one of the 4 codes the current picker handles]"}`);
	}
}

// ---------------------------------------------------------------------
heading("3. featureType code inventory: does each code resolve to any options?");
// ---------------------------------------------------------------------
{
	const allCodes = new Set();
	for (const c of classes) {
		for (const prog of c.optionalfeatureProgression || []) {
			for (const code of prog.featureType || []) allCodes.add(code);
		}
	}
	console.log(`Distinct featureType codes found across class + subclass optionalfeatureProgression: ${allCodes.size}`);
	for (const code of allCodes) {
		const matches = resolveFeatureType(code);
		const via = code.startsWith("FS:") ? "feats.json category FS (D12)" : "optional-features.json exact featureType match";
		console.log(`  ${code}: ${matches.length} option(s) via ${via}${matches.length === 0 ? "  *** ZERO — broken picker waiting to happen ***" : ""}`);
	}
}

// ---------------------------------------------------------------------
heading("4. Prerequisites on the resolved option entries");
// ---------------------------------------------------------------------
{
	// Union of every option entry any real progression code resolves to (Eldritch Invocations is the interesting one: featureType "OR" or similar? confirm from data itself)
	const allCodes = new Set();
	for (const c of classes) {
		for (const prog of c.optionalfeatureProgression || []) {
			for (const code of prog.featureType || []) allCodes.add(code);
		}
	}
	const allOptions = new Map(); // name+source -> entry
	for (const code of allCodes) {
		for (const entry of resolveFeatureType(code)) {
			allOptions.set(`${entry.name}|${entry.source}`, entry);
		}
	}
	console.log(`Distinct option entries resolved across all found codes: ${allOptions.size}`);

	const withPrereq = [...allOptions.values()].filter((e) => e.prerequisite);
	console.log(`Of those, entries carrying a "prerequisite" field: ${withPrereq.length}`);

	const shapeMap = new Map();
	for (const e of withPrereq) {
		for (const alt of e.prerequisite) {
			const keys = Object.keys(alt).sort().join("+");
			if (!shapeMap.has(keys)) shapeMap.set(keys, { count: 0, examples: [] });
			const rec = shapeMap.get(keys);
			rec.count++;
			if (rec.examples.length < 3) rec.examples.push({ name: e.name, alt });
		}
	}
	console.log("Prerequisite shapes seen (key set -> count):");
	for (const [shape, rec] of shapeMap) {
		console.log(`  [${shape}]: ${rec.count}`);
		for (const ex of rec.examples) console.log(`    e.g. ${ex.name}: ${truncate(JSON.stringify(ex.alt), 200)}`);
	}

	// Flag: does any prerequisite reference ANOTHER option in the same resolved set by name (an ordering problem)?
	console.log("");
	console.log("Cross-choice ordering check: does any prerequisite name another option from the SAME resolved set?");
	const optionNames = new Set([...allOptions.values()].map((e) => e.name.toLowerCase()));
	let orderingHits = 0;
	const orderingExamples = [];
	for (const e of withPrereq) {
		for (const alt of e.prerequisite) {
			const text = JSON.stringify(alt).toLowerCase();
			for (const otherName of optionNames) {
				if (otherName === e.name.toLowerCase()) continue;
				if (text.includes(otherName)) {
					orderingHits++;
					if (orderingExamples.length < 3) orderingExamples.push(`${e.name} prerequisite mentions "${otherName}": ${truncate(JSON.stringify(alt), 150)}`);
					break;
				}
			}
		}
	}
	console.log(`Prerequisite alternatives that textually mention another same-set option's name: ${orderingHits}`);
	for (const ex of orderingExamples) console.log(`  ${ex}`);

	// Also report the pact/patron/cantrip prereq shapes explicitly since the brief calls them out by name
	console.log("");
	console.log("Named checks the brief calls out (character level / pact-or-patron / cantrip-known):");
	const pactOrPatron = withPrereq.filter((e) => e.prerequisite.some((alt) => alt.pact || alt.patron));
	const spell = withPrereq.filter((e) => e.prerequisite.some((alt) => alt.spell));
	const level = withPrereq.filter((e) => e.prerequisite.some((alt) => alt.level));
	console.log(`  entries with a pact/patron prerequisite: ${pactOrPatron.length}`);
	console.log(`  entries with a spell (cantrip-known) prerequisite: ${spell.length}`);
	console.log(`  entries with a level prerequisite: ${level.length}`);
	if (pactOrPatron[0]) console.log(`    e.g. ${pactOrPatron[0].name}: ${truncate(JSON.stringify(pactOrPatron[0].prerequisite), 200)}`);
	if (spell[0]) console.log(`    e.g. ${spell[0].name}: ${truncate(JSON.stringify(spell[0].prerequisite), 200)}`);
}

// ---------------------------------------------------------------------
heading("5. `options`-type nodes inside feature TEXT (class-features.json / subclass-features.json)");
// ---------------------------------------------------------------------
let allOptionNodesGlobal = [];
{
	function scan(features, label) {
		const withOptions = [];
		for (const f of features) {
			const results = [];
			findNodesOfType(f.entries, "options", results);
			if (results.length > 0) withOptions.push({ feature: f, nodes: results });
		}
		console.log(`${label}: ${features.length} total features, ${withOptions.length} contain an "options" node`);

		// entry-shape breakdown across all options nodes found (ref-only vs inline text/effects)
		const allEntries = withOptions.flatMap(({ nodes }) => nodes.flatMap((n) => n.entries || []));
		const shapeCounts = new Map();
		for (const e of allEntries) {
			const shape = e && typeof e === "object" ? e.type || "plain-entries-object" : typeof e;
			shapeCounts.set(shape, (shapeCounts.get(shape) || 0) + 1);
		}
		console.log(`  option-entry shapes across those nodes (${allEntries.length} entries total):`);
		for (const [shape, count] of shapeCounts) console.log(`    ${shape}: ${count}`);

		// count-field distribution (how many options nodes actually say how many to pick)
		const allNodes = withOptions.flatMap(({ nodes }) => nodes);
		const withCount = allNodes.filter((n) => n.count !== undefined).length;
		console.log(`  "options" nodes carrying a count field (how many to pick): ${withCount} of ${allNodes.length}`);

		for (const { feature, nodes } of withOptions.slice(0, 3)) {
			const counts = nodes.map((n) => (n.count === undefined ? "none" : n.count)).join(", ");
			console.log(`  e.g. "${feature.name}" (level ${feature.level ?? "?"}) count field(s): ${counts}, ${(nodes[0].entries || []).length} option(s)`);
			const firstEntry = (nodes[0].entries || [])[0];
			console.log(`    first option entry: ${truncate(JSON.stringify(firstEntry), 200)}`);
		}
		return withOptions;
	}
	const a = scan(classFeatures, "class-features.json");
	const b = scan(subclassFeatures, "subclass-features.json");
	for (const { nodes } of [...a, ...b]) {
		for (const n of nodes) {
			for (const opt of n.entries || []) allOptionNodesGlobal.push(opt);
		}
	}
	console.log(`Total individual option entries across all "options" nodes found: ${allOptionNodesGlobal.length}`);
}

// ---------------------------------------------------------------------
heading("6. Structured effect fields on resolved option entries (report only, no decision)");
// ---------------------------------------------------------------------
{
	const effectFields = [
		"ability",
		"savingThrowProficiencies",
		"skillProficiencies",
		"expertise",
		"additionalSpells",
		"senses",
		"resist",
		"toolProficiencies",
		"weaponProficiencies",
		"armorProficiencies",
		"languageProficiencies",
		"speed",
		"optionalfeatureProgression",
	];

	// Set from item 3 (featureType-resolved options)
	const allCodes = new Set();
	for (const c of classes) {
		for (const prog of c.optionalfeatureProgression || []) {
			for (const code of prog.featureType || []) allCodes.add(code);
		}
	}
	const resolvedOptions = new Map();
	for (const code of allCodes) {
		for (const entry of resolveFeatureType(code)) {
			resolvedOptions.set(`${entry.name}|${entry.source}`, entry);
		}
	}

	console.log(`-- From item 3 (featureType-resolved options), ${resolvedOptions.size} entries --`);
	for (const field of effectFields) {
		const withField = [...resolvedOptions.values()].filter((e) => e[field] !== undefined);
		console.log(`  ${field}: ${withField.length}`);
		if (withField[0]) console.log(`    e.g. ${withField[0].name}: ${truncate(JSON.stringify(withField[0][field]), 200)}`);
	}

	console.log("");
	console.log(`-- From item 5 (options-type text nodes), ${allOptionNodesGlobal.length} entries --`);
	for (const field of effectFields) {
		const withField = allOptionNodesGlobal.filter((e) => e && typeof e === "object" && e[field] !== undefined);
		console.log(`  ${field}: ${withField.length}`);
		if (withField[0]) console.log(`    e.g. ${truncate(JSON.stringify(withField[0].name || withField[0]), 150)}`);
	}
	console.log("");
	console.log("Note: option entries with none of the above fields carry their effect in prose only (`entries`), same D21 trap as elsewhere.");
}

console.log("");
