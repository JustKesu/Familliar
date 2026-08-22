/*
 * validate-data.js
 * ================
 *
 * WHAT THIS SCRIPT DOES
 * ---------------------
 * `extract-data.js` writes cleaned-up JSON files into `data/`. This script
 * reads those files back and checks that they are actually correct — that
 * nothing was left half-processed, that nothing snuck in from a book we did
 * not want, that there are no duplicates, and so on.
 *
 * HOW TO RUN IT
 * -------------
 * From the project root, type:
 *
 *     node scripts/validate-data.js
 *
 * If everything is fine it prints a summary and exits normally.
 * If anything is wrong it prints details and exits with a non-zero code,
 * which is the standard way a program signals "something went wrong".
 *
 * ADDING MORE CATEGORIES LATER
 * ----------------------------
 * Write a `validateSpells()` style function modelled on `validateFeats()`,
 * add its expected counts to EXPECTED_COUNTS below, then call it from
 * `main()` at the bottom.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

/* ============================================================================
 * SECTION 1 — CONFIGURATION
 * ==========================================================================*/

// The folder holding the files we generated. Must match extract-data.js.
const OUTPUT_DIR = path.join(__dirname, "..", "data");

// Must match ALLOWED_SOURCES in extract-data.js.
const ALLOWED_SOURCES = ["XPHB", "XGE", "TCE", "EFA", "XDMG", "MPMM"];

/*
 * Valid values for a feat's `category` field.
 *
 * The first four are the official 2024 categories:
 *   "O"  = Origin feat
 *   "G"  = General feat
 *   "FS" = Fighting Style feat
 *   "EB" = Epic Boon
 *
 * The remaining three also genuinely occur in the source data and are NOT
 * mistakes, so they are listed here to stop the check failing on good data:
 *   "D"     = Dragonmark feat. Used by 13 feats from EFA (Eberron).
 *   "FS:P"  = A Fighting Style restricted to Paladins (1 feat in XPHB).
 *   "FS:R"  = A Fighting Style restricted to Rangers  (1 feat in XPHB).
 *
 * If you would rather treat those three as errors, delete them from this list
 * and the check will start reporting them.
 */
const VALID_FEAT_CATEGORIES = ["O", "G", "FS", "EB", "D", "FS:P", "FS:R"];

/*
 * How many entries we EXPECT from each book, per category.
 * Update these numbers as you add categories or change ALLOWED_SOURCES.
 * A mismatch usually means the extraction script changed behaviour.
 */
const EXPECTED_COUNTS = {
	feats: {
		// 77 base feats + 3 extra entries created by expanding the `_versions`
		// on "Magic Initiate" (the parent stays selectable, and it spawns
		// "; Cleric", "; Druid" and "; Wizard").
		// TCE dropped from 15 to 5: ten TCE feats were superseded by their
		// XPHB reprint (see removeSuperseded in extract-data.js).
		XPHB: 80,
		XGE: 15,
		TCE: 5,
		EFA: 28, // not in the original spec, but this is what the data contains
	},
	// Taken from the first successful extraction run. XDMG and MPMM ship no
	// spell files at all, so they are absent rather than zero.
	// TCE (21->12) and XGE (95->85) both dropped: spells superseded by a
	// newer reprint we also keep are now removed (removeSuperseded).
	spells: {
		XPHB: 391,
		XGE: 85,
		TCE: 12,
		EFA: 1,
	},
	/*
	 * Species counts include entries created by expansion:
	 *   49 kept before expansion (45 race + 4 MPMM Genasi subraces)
	 * + 28 from plain `_versions`
	 * + 10 from the Dragonborn `_abstract` template
	 * = 87, minus 9 MPMM entries superseded by their EFA/XPHB reprint
	 * (Shifter x4 variants, Aasimar, Goliath, Changeling, Orc) = 78.
	 * RHW is excluded because it is not in ALLOWED_SOURCES.
	 */
	species: {
		XPHB: 34,
		MPMM: 35,
		EFA: 9,
	},
	backgrounds: {
		XPHB: 16,
		EFA: 17,
	},
	// classes.json holds classes AND subclasses, so these are the combined
	// per-book totals: 13 classes + 114 subclasses = 127 entries.
	classes: {
		XPHB: 60, // 12 classes + 48 subclasses
		XGE: 31,
		TCE: 30,
		EFA: 6, // 1 class (Artificer) + 5 subclasses
	},
	// TCE dropped from 47 to 38: nine TCE optional features were superseded
	// by their XPHB reprint (removeSuperseded).
	"optional-features": {
		XPHB: 58,
		TCE: 38,
		XGE: 20,
		EFA: 4,
	},
	// `item` + `baseitem` only — `itemGroup` is deliberately not output.
	// TCE (84->80) and XGE (43->3) both dropped: items superseded by a newer
	// reprint we also keep (mostly XGE -> XDMG) are now removed.
	items: {
		XDMG: 593,
		XPHB: 217,
		TCE: 80,
		XGE: 3,
		EFA: 6,
	},
	// Languages ship in a single book today, so this is just the total.
	languages: {
		XPHB: 19,
	},
	// D67: XMM beasts up to CR 6 and nothing else, so this is the total.
	beasts: {
		XMM: 89,
	},
};

/*
 * Beasts come from XMM only (D67), which is deliberately NOT in
 * ALLOWED_SOURCES — the rest of that book stays out of every category.
 */
const BEAST_SOURCE = "XMM";
const BEAST_MAX_CR = 6;

// Must match BEAST_KEPT_FIELDS' mandatory half in extract-data.js: the fields
// no beast stat block can be played without.
const REQUIRED_BEAST_FIELDS = [
	"name",
	"source",
	"size",
	"type",
	"cr",
	"crNumber",
	"ac",
	"hp",
	"speed",
	"str",
	"dex",
	"con",
	"int",
	"wis",
	"cha",
	"action",
];

/*
 * The beasts Find Familiar names in its own spell text. If a filter change
 * ever drops one of these the spell becomes uncastable as written, so they
 * are asserted by name rather than by count.
 */
const FIND_FAMILIAR_BEASTS = [
	"Bat",
	"Cat",
	"Frog",
	"Hawk",
	"Lizard",
	"Octopus",
	"Owl",
	"Rat",
	"Raven",
	"Spider",
	"Weasel",
];

// Valid values for a language's `type` field.
const VALID_LANGUAGE_TYPES = ["standard", "rare"];

// Feature files are checked on total size rather than per-book, because a
// feature's own source is not what decides whether it is kept.
// 279 -> 302 and 465 -> 786: extraction now also collects features reached
// only via a ref* node inside another feature's text, not just the
// classFeatureIds/subclassFeatureIds lists (see docs/DATA.md, "Traps").
const EXPECTED_FEATURE_TOTALS = {
	"class-features": 302,
	"subclass-features": 786,
};

// Fields every class / subclass must carry for character building to work.
const REQUIRED_CLASS_FIELDS = ["name", "source", "hd", "proficiency", "startingProficiencies", "classFeatures"];
const REQUIRED_SUBCLASS_FIELDS = ["className", "classSource", "shortName", "subclassFeatures"];

/*
 * The fields a 2024 background must carry, because they are where a
 * character's ability increases and origin feat come from.
 */
const REQUIRED_BACKGROUND_FIELDS = ["ability", "feats"];

// Never print more than this many examples of the same kind of failure.
const MAX_EXAMPLES_PER_CHECK = 10;

/* ============================================================================
 * SECTION 2 — THE CHECK RECORDER
 * ----------------------------------------------------------------------------
 * A tiny helper object that remembers every check we ran and whether it
 * passed, so we can print a tidy summary at the end.
 * ==========================================================================*/

const results = {
	passed: 0,
	failed: 0,
};

/*
 * Records a check that either fully passed or produced a list of failures.
 *
 * checkName  — a short description shown to you
 * failures   — an array of { label, detail } describing what went wrong.
 *              An empty array means the check passed.
 */
function recordCheck(checkName, failures) {
	if (failures.length === 0) {
		results.passed++;
		console.log(`  PASS  ${checkName}`);
		return;
	}

	results.failed++;
	console.log(`  FAIL  ${checkName} — ${failures.length} problem(s)`);

	// Show at most MAX_EXAMPLES_PER_CHECK of them, then say how many remain.
	const shown = failures.slice(0, MAX_EXAMPLES_PER_CHECK);
	for (const failure of shown) {
		console.log(`          - ${failure.label}: ${failure.detail}`);
	}
	const remaining = failures.length - shown.length;
	if (remaining > 0) console.log(`          ...and ${remaining} more.`);
}

/*
 * Records a simple yes/no check (used for the expected-count assertions).
 */
function recordSimpleCheck(checkName, isPass, actualVsExpected) {
	if (isPass) {
		results.passed++;
		console.log(`  PASS  ${checkName} (${actualVsExpected})`);
	} else {
		results.failed++;
		console.log(`  FAIL  ${checkName} (${actualVsExpected})`);
	}
}

/* ============================================================================
 * SECTION 3 — SMALL HELPERS
 * ==========================================================================*/

// Reads one of our generated JSON files.
function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/*
 * A short human-readable label for an entry, used in failure messages so you
 * can tell which record is the problem.
 */
function describeEntry(entry, index) {
	const name = entry && entry.name ? entry.name : "(no name)";
	const source = entry && entry.source ? entry.source : "(no source)";
	return `#${index} "${name}" (${source})`;
}

/*
 * Searches a value and everything nested inside it for a given key name.
 * Returns true as soon as it finds one.
 *
 * We need this because a leftover `_copy` might be buried deep inside an
 * entry, not just sitting at the top level.
 */
function containsKeyDeep(value, keyName) {
	if (Array.isArray(value)) {
		return value.some((item) => containsKeyDeep(item, keyName));
	}
	if (value !== null && typeof value === "object") {
		if (Object.prototype.hasOwnProperty.call(value, keyName)) return true;
		return Object.values(value).some((inner) => containsKeyDeep(inner, keyName));
	}
	// Strings, numbers, booleans and null cannot contain keys.
	return false;
}

/* ============================================================================
 * SECTION 4 — CHECKS THAT APPLY TO EVERY CATEGORY
 * ----------------------------------------------------------------------------
 * These four are reused by every category validator you add later.
 * ==========================================================================*/

// CHECK 1 — no leftover templating keys anywhere in the output.
// `keyNames` lets a category ask for extra keys to be checked (spells also
// check `_versions`).
function checkNoLeftoverCopyKeys(entries, categoryName, keyNames = ["_copy", "_mod"]) {
	for (const keyName of keyNames) {
		const failures = [];
		entries.forEach((entry, index) => {
			if (containsKeyDeep(entry, keyName)) {
				failures.push({
					label: describeEntry(entry, index),
					detail: `still contains a "${keyName}" key somewhere inside it`,
				});
			}
		});
		recordCheck(`${categoryName}: no leftover "${keyName}" keys`, failures);
	}
}

// CHECK 2 — every entry's source is one we allow.
function checkSourcesAllowed(entries, categoryName) {
	const failures = [];
	entries.forEach((entry, index) => {
		if (!ALLOWED_SOURCES.includes(entry.source)) {
			failures.push({
				label: describeEntry(entry, index),
				detail: `source "${entry.source}" is not in the allowed list`,
			});
		}
	});
	recordCheck(`${categoryName}: all sources allowed`, failures);
}

// CHECK 3 — no two entries share the same name AND source.
function checkNoDuplicates(entries, categoryName) {
	const failures = [];
	const seen = new Map(); // "name|source" -> index we first saw it at

	entries.forEach((entry, index) => {
		const key = `${entry.name}|${entry.source}`;
		if (seen.has(key)) {
			failures.push({
				label: describeEntry(entry, index),
				detail: `duplicate of entry #${seen.get(key)} (same name + source)`,
			});
		} else {
			seen.set(key, index);
		}
	});

	recordCheck(`${categoryName}: no duplicate name+source`, failures);
}

// CHECK 4 — every entry has a real name and a non-empty `entries` array.
function checkNameAndEntries(entries, categoryName) {
	const failures = [];

	entries.forEach((entry, index) => {
		if (typeof entry.name !== "string" || entry.name.trim() === "") {
			failures.push({
				label: describeEntry(entry, index),
				detail: `name is missing or empty (got ${JSON.stringify(entry.name)})`,
			});
		}
		if (!Array.isArray(entry.entries) || entry.entries.length === 0) {
			failures.push({
				label: describeEntry(entry, index),
				detail: `"entries" is missing or empty (got ${JSON.stringify(entry.entries)})`,
			});
		}
	});

	recordCheck(`${categoryName}: name and entries present`, failures);
}

/*
 * Splits a "Name|Source" reprintedAs target the same way extract-data.js
 * does, for the same reason: no default source is implied.
 */
function splitReprintTarget(target) {
	const separatorIndex = target.lastIndexOf("|");
	if (separatorIndex === -1) return { name: target, source: "" };
	return { name: target.slice(0, separatorIndex), source: target.slice(separatorIndex + 1) };
}

/*
 * CHECK 5 (shared) — no entry should still be superseded by a kept reprint.
 *
 * extract-data.js's removeSuperseded() is supposed to drop an entry whose
 * OWN `reprintedAs` points at another entry we also kept. If one slipped
 * through, this catches it.
 *
 * A `reprintedAs` target's name matching the entry's OWN name is what marks
 * it as describing THIS entry's reprint. A `_versions` variant (e.g. MPMM
 * Aasimar's "Necrotic Shroud" sub-entries) can carry a `reprintedAs`
 * inherited from its PARENT, whose target names the parent instead — that
 * is a different entry's business, not a leftover duplicate of this one, so
 * it is correctly not flagged here. See extract-data.js's long comment on
 * removeSuperseded for the full story (NOTES.md, "Nine species names occur
 * twice").
 */
function checkNoSupersededDuplicates(entries, categoryName) {
	const keptKeys = new Set(entries.map((entry) => `${entry.name}|${entry.source}`));
	const failures = [];

	entries.forEach((entry, index) => {
		const targets = []
			.concat(entry.reprintedAs || [])
			.map((target) => (typeof target === "string" ? target : target && target.uid))
			.filter(Boolean);

		for (const target of targets) {
			const { name, source } = splitReprintTarget(target);
			if (name !== entry.name) continue; // describes a parent, not this entry
			if (keptKeys.has(`${name}|${source}`)) {
				failures.push({
					label: describeEntry(entry, index),
					detail: `still present alongside its reprint "${target}" — removeSuperseded should have dropped it`,
				});
			}
		}
	});

	recordCheck(`${categoryName}: no leftover superseded duplicates`, failures);
}

// CHECK 6 — the number of entries from each book matches what we expect.
function checkExpectedCounts(entries, categoryName) {
	const expected = EXPECTED_COUNTS[categoryName];
	if (!expected) return; // no expectations configured for this category

	// Count how many entries we actually got from each book.
	const actual = {};
	for (const entry of entries) {
		actual[entry.source] = (actual[entry.source] || 0) + 1;
	}

	for (const source of Object.keys(expected)) {
		const expectedCount = expected[source];
		const actualCount = actual[source] || 0;
		recordSimpleCheck(
			`${categoryName}: ${source} count`,
			actualCount === expectedCount,
			`actual ${actualCount}, expected ${expectedCount}`,
		);
	}
}

/* ============================================================================
 * SECTION 5 — CATEGORY VALIDATORS
 * ==========================================================================*/

function validateFeats() {
	const filePath = path.join(OUTPUT_DIR, "feats.json");
	console.log("\n--- feats.json ---");

	if (!fs.existsSync(filePath)) {
		results.failed++;
		console.log(`  FAIL  file not found: ${filePath}`);
		console.log("        Run `node scripts/extract-data.js` first.");
		return;
	}

	const entries = readJson(filePath);

	if (!Array.isArray(entries)) {
		results.failed++;
		console.log("  FAIL  file does not contain a JSON array at the top level");
		return;
	}

	console.log(`  (${entries.length} entries loaded)`);

	// The four checks every category gets.
	checkNoLeftoverCopyKeys(entries, "feats");
	checkSourcesAllowed(entries, "feats");
	checkNoDuplicates(entries, "feats");
	checkNameAndEntries(entries, "feats");
	checkNoSupersededDuplicates(entries, "feats");

	// CHECK 5 — feats specifically must have a valid `category`.
	const categoryFailures = [];
	entries.forEach((entry, index) => {
		if (entry.category === undefined || entry.category === null) {
			categoryFailures.push({
				label: describeEntry(entry, index),
				detail: "has no \"category\" field at all",
			});
		} else if (!VALID_FEAT_CATEGORIES.includes(entry.category)) {
			categoryFailures.push({
				label: describeEntry(entry, index),
				detail: `category "${entry.category}" is not one of ${VALID_FEAT_CATEGORIES.join(", ")}`,
			});
		}
	});
	recordCheck("feats: every feat has a valid category", categoryFailures);

	// The expected per-book counts.
	checkExpectedCounts(entries, "feats");
}

function validateSpells() {
	const filePath = path.join(OUTPUT_DIR, "spells.json");
	console.log("\n--- spells.json ---");

	if (!fs.existsSync(filePath)) {
		results.failed++;
		console.log(`  FAIL  file not found: ${filePath}`);
		console.log("        Run `node scripts/extract-data.js` first.");
		return;
	}

	const entries = readJson(filePath);

	if (!Array.isArray(entries)) {
		results.failed++;
		console.log("  FAIL  file does not contain a JSON array at the top level");
		return;
	}

	console.log(`  (${entries.length} entries loaded)`);

	// Shared checks. Spells also get `_versions` checked.
	checkNoLeftoverCopyKeys(entries, "spells", ["_copy", "_mod", "_versions"]);
	checkSourcesAllowed(entries, "spells");
	checkNoDuplicates(entries, "spells");
	checkNoSupersededDuplicates(entries, "spells");

	/*
	 * Every spell needs the fields a character sheet actually reads.
	 * `level` gets an extra check because it must be a whole number from 0
	 * (a cantrip) to 9.
	 */
	const fieldFailures = [];
	entries.forEach((entry, index) => {
		const label = describeEntry(entry, index);

		if (typeof entry.name !== "string" || entry.name.trim() === "") {
			fieldFailures.push({ label, detail: `name is missing or empty (got ${JSON.stringify(entry.name)})` });
		}

		if (typeof entry.level !== "number" || !Number.isInteger(entry.level) || entry.level < 0 || entry.level > 9) {
			fieldFailures.push({ label, detail: `level must be a whole number 0-9 (got ${JSON.stringify(entry.level)})` });
		}

		if (typeof entry.school !== "string" || entry.school.trim() === "") {
			fieldFailures.push({ label, detail: `school is missing or empty (got ${JSON.stringify(entry.school)})` });
		}

		// These two must be non-empty arrays.
		for (const prop of ["time", "duration", "entries"]) {
			if (!Array.isArray(entry[prop]) || entry[prop].length === 0) {
				fieldFailures.push({ label, detail: `"${prop}" is missing or empty` });
			}
		}

		// These two must be objects.
		for (const prop of ["range", "components"]) {
			if (entry[prop] === null || typeof entry[prop] !== "object" || Array.isArray(entry[prop])) {
				fieldFailures.push({ label, detail: `"${prop}" is missing or is not an object` });
			}
		}
	});
	recordCheck("spells: required fields present and well-formed", fieldFailures);

	/*
	 * `availableTo` is the class-availability information we attached during
	 * extraction. Every spell must have it, with all five lists present.
	 */
	const availabilityFailures = [];
	const AVAILABILITY_LISTS = ["classes", "classVariants", "subclasses", "feats", "optionalFeatures"];
	entries.forEach((entry, index) => {
		const label = describeEntry(entry, index);

		if (entry.availableTo === null || typeof entry.availableTo !== "object" || Array.isArray(entry.availableTo)) {
			availabilityFailures.push({ label, detail: `"availableTo" is missing or is not an object` });
			return;
		}
		for (const listName of AVAILABILITY_LISTS) {
			if (!Array.isArray(entry.availableTo[listName])) {
				availabilityFailures.push({ label, detail: `availableTo.${listName} is missing or not an array` });
			}
		}
	});
	recordCheck("spells: availableTo present on every spell", availabilityFailures);

	checkExpectedCounts(entries, "spells");
}

function validateSpecies() {
	const filePath = path.join(OUTPUT_DIR, "species.json");
	console.log("\n--- species.json ---");

	if (!fs.existsSync(filePath)) {
		results.failed++;
		console.log(`  FAIL  file not found: ${filePath}`);
		console.log("        Run `node scripts/extract-data.js` first.");
		return;
	}

	const entries = readJson(filePath);

	if (!Array.isArray(entries)) {
		results.failed++;
		console.log("  FAIL  file does not contain a JSON array at the top level");
		return;
	}

	console.log(`  (${entries.length} entries loaded)`);

	// Species use every templating mechanism we support, so check for all of
	// them — including the template form.
	checkNoLeftoverCopyKeys(entries, "species", [
		"_copy",
		"_mod",
		"_versions",
		"_abstract",
		"_implementations",
	]);

	// MPMM is already part of ALLOWED_SOURCES, so this covers the
	// "allowed list plus MPMM" requirement.
	checkSourcesAllowed(entries, "species");
	checkNoDuplicates(entries, "species");
	checkNameAndEntries(entries, "species");
	checkNoSupersededDuplicates(entries, "species");

	// Every entry must name its book.
	const sourceFailures = [];
	entries.forEach((entry, index) => {
		if (typeof entry.source !== "string" || entry.source.trim() === "") {
			sourceFailures.push({
				label: describeEntry(entry, index),
				detail: `source is missing or empty (got ${JSON.stringify(entry.source)})`,
			});
		}
	});
	recordCheck("species: source present", sourceFailures);

	/*
	 * Under 2024 rules a species never grants ability score increases —
	 * those come from the background. Any surviving `ability` field would
	 * risk being applied twice.
	 */
	const abilityFailures = [];
	entries.forEach((entry, index) => {
		if (entry.ability !== undefined) {
			abilityFailures.push({
				label: describeEntry(entry, index),
				detail: `still has an "ability" field: ${JSON.stringify(entry.ability)}`,
			});
		}
	});
	recordCheck("species: no ability field", abilityFailures);

	checkExpectedCounts(entries, "species");
}

function validateBackgrounds() {
	const filePath = path.join(OUTPUT_DIR, "backgrounds.json");
	console.log("\n--- backgrounds.json ---");

	if (!fs.existsSync(filePath)) {
		results.failed++;
		console.log(`  FAIL  file not found: ${filePath}`);
		console.log("        Run `node scripts/extract-data.js` first.");
		return;
	}

	const entries = readJson(filePath);

	if (!Array.isArray(entries)) {
		results.failed++;
		console.log("  FAIL  file does not contain a JSON array at the top level");
		return;
	}

	console.log(`  (${entries.length} entries loaded)`);

	checkNoLeftoverCopyKeys(entries, "backgrounds", [
		"_copy",
		"_mod",
		"_versions",
		"_abstract",
		"_implementations",
	]);
	checkSourcesAllowed(entries, "backgrounds");
	checkNoDuplicates(entries, "backgrounds");
	checkNameAndEntries(entries, "backgrounds");
	checkNoSupersededDuplicates(entries, "backgrounds");

	/*
	 * A 2024 background is where the character's ability score increases and
	 * origin feat come from. If either field were missing, character creation
	 * would silently produce a weaker character, so this gets its own check.
	 *
	 * Only XPHB entries are required to have them — other books may print
	 * backgrounds that work differently.
	 */
	const originFailures = [];
	const xphbEntries = entries.filter((entry) => entry.source === "XPHB");
	for (const field of REQUIRED_BACKGROUND_FIELDS) {
		xphbEntries.forEach((entry) => {
			const value = entry[field];
			const isMissing = value === undefined || value === null || (Array.isArray(value) && value.length === 0);
			if (isMissing) {
				originFailures.push({
					label: `"${entry.name}" (${entry.source})`,
					detail: `missing or empty "${field}" — a 2024 background must have it`,
				});
			}
		});
	}
	recordCheck(
		`backgrounds: all ${xphbEntries.length} XPHB entries have ${REQUIRED_BACKGROUND_FIELDS.map((f) => `"${f}"`).join(" and ")}`,
		originFailures,
	);

	checkExpectedCounts(entries, "backgrounds");
}

function validateLanguages() {
	console.log("\n--- languages.json ---");

	const entries = loadOutputFile("languages.json");
	if (!entries) return;

	console.log(`  (${entries.length} entries loaded)`);

	// Languages carry no `entries` array (see extract-data.js), so the shared
	// checkNameAndEntries check does not apply here.
	checkNoLeftoverCopyKeys(entries, "languages");
	checkSourcesAllowed(entries, "languages");
	checkNoDuplicates(entries, "languages");
	checkNoSupersededDuplicates(entries, "languages");

	const nameFailures = [];
	entries.forEach((entry, index) => {
		if (typeof entry.name !== "string" || entry.name.trim() === "") {
			nameFailures.push({
				label: describeEntry(entry, index),
				detail: `name is missing or empty (got ${JSON.stringify(entry.name)})`,
			});
		}
	});
	recordCheck("languages: name present", nameFailures);

	// CHECK — every language's `type` must be one of the values 5etools uses.
	const typeFailures = [];
	entries.forEach((entry, index) => {
		if (!VALID_LANGUAGE_TYPES.includes(entry.type)) {
			typeFailures.push({
				label: describeEntry(entry, index),
				detail: `type "${entry.type}" is not one of ${VALID_LANGUAGE_TYPES.join(", ")}`,
			});
		}
	});
	recordCheck("languages: every language has a valid type", typeFailures);

	checkExpectedCounts(entries, "languages");
}

function validateBeasts() {
	console.log("\n--- beasts.json ---");

	const entries = loadOutputFile("beasts.json");
	if (!entries) return;

	console.log(`  (${entries.length} entries loaded)`);

	recordSimpleCheck("beasts: file is not empty", entries.length > 0, `${entries.length} entries`);

	// Beasts carry no `entries` array — their text lives in trait/action — so
	// the shared checkNameAndEntries does not apply.
	checkNoLeftoverCopyKeys(entries, "beasts");
	checkNoDuplicates(entries, "beasts");

	const fieldFailures = [];
	entries.forEach((entry, index) => {
		for (const field of REQUIRED_BEAST_FIELDS) {
			const value = entry[field];
			const isMissing = value === undefined || value === null || (Array.isArray(value) && value.length === 0);
			if (isMissing) {
				fieldFailures.push({
					label: describeEntry(entry, index),
					detail: `missing or empty "${field}" — a playable stat block must have it`,
				});
			}
		}
	});
	recordCheck(`beasts: every entry has all ${REQUIRED_BEAST_FIELDS.length} stat-block fields`, fieldFailures);

	// CHECK — the CR cap from D67. `crNumber` is the sortable form; a fraction
	// CR arrives as a display string ("1/4") and must not be compared raw.
	const crFailures = [];
	entries.forEach((entry, index) => {
		if (typeof entry.crNumber !== "number" || Number.isNaN(entry.crNumber)) {
			crFailures.push({ label: describeEntry(entry, index), detail: `crNumber is not a number (got ${JSON.stringify(entry.crNumber)})` });
			return;
		}
		if (entry.crNumber > BEAST_MAX_CR) {
			crFailures.push({ label: describeEntry(entry, index), detail: `CR ${entry.cr} exceeds the cap of ${BEAST_MAX_CR}` });
		}
	});
	recordCheck(`beasts: no entry above CR ${BEAST_MAX_CR}`, crFailures);

	const sourceFailures = [];
	entries.forEach((entry, index) => {
		if (entry.source !== BEAST_SOURCE) {
			sourceFailures.push({ label: describeEntry(entry, index), detail: `source "${entry.source}" is not ${BEAST_SOURCE}` });
		}
	});
	recordCheck(`beasts: every entry comes from ${BEAST_SOURCE}`, sourceFailures);

	const typeFailures = [];
	entries.forEach((entry, index) => {
		const types = [].concat(entry.type);
		const isBeast = types.some((value) => (typeof value === "string" ? value === "beast" : Boolean(value) && value.type === "beast"));
		if (!isBeast) {
			typeFailures.push({ label: describeEntry(entry, index), detail: `type ${JSON.stringify(entry.type)} is not beast` });
		}
	});
	recordCheck("beasts: every entry is of type beast", typeFailures);

	const names = new Set(entries.map((entry) => entry.name));
	const familiarFailures = FIND_FAMILIAR_BEASTS.filter((name) => !names.has(name)).map((name) => ({
		label: `"${name}"`,
		detail: "named in the Find Familiar spell text but absent from the beast pool",
	}));
	recordCheck(`beasts: all ${FIND_FAMILIAR_BEASTS.length} Find Familiar beasts are present`, familiarFailures);

	checkExpectedCounts(entries, "beasts");
}

/* ============================================================================
 * SECTION 5b — CLASS VALIDATORS
 * ==========================================================================*/

// Loads one of our generated files, or records a failure and returns null.
function loadOutputFile(fileName) {
	const filePath = path.join(OUTPUT_DIR, fileName);
	if (!fs.existsSync(filePath)) {
		results.failed++;
		console.log(`  FAIL  file not found: ${filePath}`);
		console.log("        Run `node scripts/extract-data.js` first.");
		return null;
	}
	const entries = readJson(filePath);
	if (!Array.isArray(entries)) {
		results.failed++;
		console.log(`  FAIL  ${fileName} does not contain a JSON array at the top level`);
		return null;
	}
	return entries;
}

// Every feature must have a unique `id`, since the app builds a lookup from it.
function checkNoDuplicateIds(entries, categoryName) {
	const failures = [];
	const seen = new Map();
	entries.forEach((entry, index) => {
		if (typeof entry.id !== "string" || entry.id.trim() === "") {
			failures.push({ label: describeEntry(entry, index), detail: `missing or empty "id"` });
			return;
		}
		if (seen.has(entry.id)) {
			failures.push({ label: describeEntry(entry, index), detail: `duplicate id "${entry.id}" (first seen at #${seen.get(entry.id)})` });
		} else {
			seen.set(entry.id, index);
		}
	});
	recordCheck(`${categoryName}: every entry has a unique id`, failures);
}

function validateClasses() {
	console.log("\n--- classes.json + feature files ---");

	const classEntries = loadOutputFile("classes.json");
	const classFeatures = loadOutputFile("class-features.json");
	const subclassFeatures = loadOutputFile("subclass-features.json");
	if (!classEntries || !classFeatures || !subclassFeatures) return;

	const classes = classEntries.filter((entry) => entry.entryType === "class");
	const subclasses = classEntries.filter((entry) => entry.entryType === "subclass");
	console.log(`  (${classes.length} classes, ${subclasses.length} subclasses, ${classFeatures.length} class features, ${subclassFeatures.length} subclass features)`);

	// --- shared structural checks -------------------------------------------
	for (const [entries, name] of [
		[classEntries, "classes"],
		[classFeatures, "class-features"],
		[subclassFeatures, "subclass-features"],
	]) {
		checkNoLeftoverCopyKeys(entries, name, ["_copy", "_mod", "_versions", "_abstract", "_implementations"]);
		checkSourcesAllowed(entries, name);
	}

	checkNoDuplicateIds(classFeatures, "class-features");
	checkNoDuplicateIds(subclassFeatures, "subclass-features");

	/*
	 * Duplicate check for classes.json uses more than name+source: two
	 * different classes can each have a subclass of the same name, and the
	 * same subclass exists once per class edition.
	 */
	const dupFailures = [];
	const seenKeys = new Map();
	classEntries.forEach((entry, index) => {
		const key = [entry.entryType, entry.name, entry.source, entry.className || "", entry.classSource || ""].join("|").toLowerCase();
		if (seenKeys.has(key)) {
			dupFailures.push({ label: describeEntry(entry, index), detail: `duplicate of entry #${seenKeys.get(key)} (same type, name, source, class and class edition)` });
		} else {
			seenKeys.set(key, index);
		}
	});
	recordCheck("classes: no duplicate class/subclass entries", dupFailures);
	checkNoSupersededDuplicates(classEntries, "classes");

	// --- THE IMPORTANT ONE: reference integrity -----------------------------
	/*
	 * Every reference a class or subclass makes must resolve to a real entry
	 * in the feature files. If this fails, the app will render a class with
	 * missing features and no error, so it is checked explicitly.
	 */
	const knownFeatureIds = new Set([...classFeatures, ...subclassFeatures].map((entry) => entry.id));
	const danglingFailures = [];

	for (const entry of classEntries) {
		const ids = entry.entryType === "class" ? entry.classFeatureIds : entry.subclassFeatureIds;
		const originals = entry.entryType === "class" ? entry.classFeatures : entry.subclassFeatures;

		if (!Array.isArray(ids)) {
			danglingFailures.push({
				label: `"${entry.name}" (${entry.source})`,
				detail: `has no ${entry.entryType === "class" ? "classFeatureIds" : "subclassFeatureIds"} list`,
			});
			continue;
		}

		ids.forEach((id, position) => {
			if (knownFeatureIds.has(id)) return;
			const original = originals && originals[position];
			const originalText = typeof original === "string" ? original : JSON.stringify(original);
			danglingFailures.push({
				label: `"${entry.name}" (${entry.source})`,
				detail: `reference ${originalText} -> id "${id}" matches no feature entry`,
			});
		});
	}

	const totalReferences = classEntries.reduce(
		(sum, entry) => sum + ((entry.entryType === "class" ? entry.classFeatureIds : entry.subclassFeatureIds) || []).length,
		0,
	);
	recordCheck(`classes: all ${totalReferences} feature references resolve`, danglingFailures);

	// --- required fields ----------------------------------------------------
	const classFieldFailures = [];
	classes.forEach((entry, index) => {
		for (const field of REQUIRED_CLASS_FIELDS) {
			if (entry[field] === undefined || entry[field] === null) {
				classFieldFailures.push({ label: describeEntry(entry, index), detail: `missing required class field "${field}"` });
			}
		}
	});
	recordCheck(`classes: all ${classes.length} classes have ${REQUIRED_CLASS_FIELDS.join(", ")}`, classFieldFailures);

	const subclassFieldFailures = [];
	subclasses.forEach((entry, index) => {
		for (const field of REQUIRED_SUBCLASS_FIELDS) {
			if (entry[field] === undefined || entry[field] === null) {
				subclassFieldFailures.push({ label: describeEntry(entry, index), detail: `missing required subclass field "${field}"` });
			}
		}
	});
	recordCheck(`classes: all ${subclasses.length} subclasses have ${REQUIRED_SUBCLASS_FIELDS.join(", ")}`, subclassFieldFailures);

	// --- counts -------------------------------------------------------------
	checkExpectedCounts(classEntries, "classes");

	for (const [name, entries] of [["class-features", classFeatures], ["subclass-features", subclassFeatures]]) {
		const expected = EXPECTED_FEATURE_TOTALS[name];
		recordSimpleCheck(`${name}: total count`, entries.length === expected, `actual ${entries.length}, expected ${expected}`);
	}
}

function validateOptionalFeatures() {
	console.log("\n--- optional-features.json ---");

	const entries = loadOutputFile("optional-features.json");
	if (!entries) return;

	console.log(`  (${entries.length} entries loaded)`);

	checkNoLeftoverCopyKeys(entries, "optional-features", ["_copy", "_mod", "_versions", "_abstract", "_implementations"]);
	checkSourcesAllowed(entries, "optional-features");
	checkNoDuplicates(entries, "optional-features");
	checkNameAndEntries(entries, "optional-features");
	checkNoSupersededDuplicates(entries, "optional-features");

	// Each entry must have its featureType translated into readable text.
	const typeFailures = [];
	entries.forEach((entry, index) => {
		if (!Array.isArray(entry.featureTypeFull) || entry.featureTypeFull.length === 0) {
			typeFailures.push({ label: describeEntry(entry, index), detail: `missing or empty "featureTypeFull"` });
			return;
		}
		if (entry.featureTypeFull.length !== (entry.featureType || []).length) {
			typeFailures.push({
				label: describeEntry(entry, index),
				detail: `featureTypeFull has ${entry.featureTypeFull.length} item(s) but featureType has ${(entry.featureType || []).length}`,
			});
		}
	});
	recordCheck("optional-features: featureTypeFull present for every featureType", typeFailures);

	checkExpectedCounts(entries, "optional-features");
}

function validateItems() {
	console.log("\n--- items.json ---");

	const entries = loadOutputFile("items.json");
	if (!entries) return;

	console.log(`  (${entries.length} entries loaded)`);

	checkNoLeftoverCopyKeys(entries, "items", ["_copy", "_mod", "_versions", "_abstract", "_implementations"]);
	checkSourcesAllowed(entries, "items");
	checkNoDuplicates(entries, "items");
	checkNoSupersededDuplicates(entries, "items");

	// Every item needs a name and a source. Items deliberately do NOT need an
	// `entries` array — plenty of mundane gear has no descriptive text.
	const basicFailures = [];
	entries.forEach((entry, index) => {
		if (typeof entry.name !== "string" || entry.name.trim() === "") {
			basicFailures.push({ label: describeEntry(entry, index), detail: `name is missing or empty (got ${JSON.stringify(entry.name)})` });
		}
		if (typeof entry.source !== "string" || entry.source.trim() === "") {
			basicFailures.push({ label: describeEntry(entry, index), detail: `source is missing or empty (got ${JSON.stringify(entry.source)})` });
		}
	});
	recordCheck("items: name and source present", basicFailures);

	/*
	 * Wherever the source data carried a code, the readable version must have
	 * been worked out. `rarity` is checked for presence only, since it is
	 * already stored as plain words and needs no lookup.
	 */
	const resolvedFailures = [];
	entries.forEach((entry, index) => {
		const label = describeEntry(entry, index);

		if (entry.type !== undefined && entry.typeFull === undefined) {
			resolvedFailures.push({ label, detail: `has type "${entry.type}" but no resolved "typeFull"` });
		}
		if (entry.dmgType !== undefined && entry.dmgTypeFull === undefined) {
			resolvedFailures.push({ label, detail: `has dmgType "${entry.dmgType}" but no resolved "dmgTypeFull"` });
		}
		if (Array.isArray(entry.property) && !Array.isArray(entry.propertyFull)) {
			resolvedFailures.push({ label, detail: `has property ${JSON.stringify(entry.property)} but no resolved "propertyFull"` });
		}
		if (Array.isArray(entry.mastery) && !Array.isArray(entry.masteryFull)) {
			resolvedFailures.push({ label, detail: `has mastery ${JSON.stringify(entry.mastery)} but no resolved "masteryFull"` });
		}
		if (entry.rarity === undefined && entry.type !== undefined) {
			resolvedFailures.push({ label, detail: `has a type but no "rarity"` });
		}
	});
	recordCheck("items: type/rarity resolved wherever the source had one", resolvedFailures);

	/*
	 * A code that could not be looked up is passed through unchanged, so a
	 * resolved value identical to its raw code means the legend was missing
	 * an entry. This catches that.
	 */
	const unresolvedFailures = [];
	entries.forEach((entry, index) => {
		const label = describeEntry(entry, index);

		(entry.property || []).forEach((raw, position) => {
			const uid = typeof raw === "string" ? raw : raw && raw.uid;
			const resolved = (entry.propertyFull || [])[position];
			if (uid !== undefined && resolved === uid) {
				unresolvedFailures.push({ label, detail: `property code "${uid}" was not translated (no legend entry)` });
			}
		});

		(entry.mastery || []).forEach((raw, position) => {
			const uid = typeof raw === "string" ? raw : raw && raw.uid;
			const resolved = (entry.masteryFull || [])[position];
			if (uid !== undefined && resolved === uid) {
				unresolvedFailures.push({ label, detail: `mastery code "${uid}" was not translated (no legend entry)` });
			}
		});
	});
	recordCheck("items: no unknown codes left unresolved", unresolvedFailures);

	checkExpectedCounts(entries, "items");
}

/*
 * Runs check-dangling-refs.js (cross-file reference integrity — prerequisites,
 * granted features, class progressions, etc.) and folds its result into this
 * script's pass/fail totals.
 */
function validateDanglingRefs() {
	console.log("\n--- check-dangling-refs.js ---");
	const scriptPath = path.join(__dirname, "check-dangling-refs.js");
	try {
		const output = execFileSync(process.execPath, [scriptPath], { encoding: "utf8" });
		console.log(output.trimEnd());
		results.passed++;
	} catch (error) {
		if (error.stdout) console.log(error.stdout.trimEnd());
		if (error.stderr) console.log(error.stderr.trimEnd());
		results.failed++;
	}
}

/* ============================================================================
 * SECTION 6 — MAIN
 * ==========================================================================*/

function main() {
	console.log("=".repeat(64));
	console.log("Validating generated data");
	console.log("=".repeat(64));
	console.log(`Reading from: ${OUTPUT_DIR}`);

	// ---- Add one line per category here as you build them out. ----
	validateFeats();
	validateSpells();
	validateSpecies();
	validateBackgrounds();
	validateClasses();
	validateOptionalFeatures();
	validateItems();
	validateLanguages();
	validateBeasts();
	validateDanglingRefs();
	// ---------------------------------------------------------------

	const total = results.passed + results.failed;
	console.log(`\n${"=".repeat(64)}`);
	console.log(`Checks run:    ${total}`);
	console.log(`Passed:        ${results.passed}`);
	console.log(`Failed:        ${results.failed}`);
	console.log("=".repeat(64));

	if (results.failed > 0) {
		console.log("\nVALIDATION FAILED");
		// A non-zero exit code is how a program says "I finished badly".
		process.exit(1);
	}
	console.log("\nVALIDATION PASSED");
}

main();
