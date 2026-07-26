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
		XPHB: 80,
		XGE: 15,
		TCE: 15,
		EFA: 28, // not in the original spec, but this is what the data contains
	},
	// Taken from the first successful extraction run. XDMG and MPMM ship no
	// spell files at all, so they are absent rather than zero.
	spells: {
		XPHB: 391,
		XGE: 95,
		TCE: 21,
		EFA: 1,
	},
	/*
	 * Species counts include entries created by expansion:
	 *   49 kept before expansion (45 race + 4 MPMM Genasi subraces)
	 * + 28 from plain `_versions`
	 * + 10 from the Dragonborn `_abstract` template
	 * = 87
	 * RHW is excluded because it is not in ALLOWED_SOURCES.
	 */
	species: {
		XPHB: 34,
		MPMM: 44,
		EFA: 9,
	},
	backgrounds: {
		XPHB: 16,
		EFA: 17,
	},
};

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
