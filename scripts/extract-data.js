/*
 * extract-data.js
 * ===============
 *
 * WHAT THIS SCRIPT DOES
 * ---------------------
 * The folder `data-source/` contains a full copy of the 5etools project.
 * That copy is huge (~108 MB) and contains far more than a character sheet
 * app needs. This script reads that data, picks out only the bits we want,
 * cleans them up, and writes small, tidy JSON files into `data/` in the
 * project root.
 *
 * HOW TO RUN IT
 * -------------
 * From the project root, type:
 *
 *     node scripts/extract-data.js
 *
 * It prints a short report and exits. It only ever READS from `data-source/`
 * and only ever WRITES into `data/`.
 *
 * WHY THE "_copy" RESOLVER EXISTS
 * -------------------------------
 * A lot of 5etools entries do not contain their own text. Instead they say
 * "I am a copy of that other entry over there, with these small changes".
 * That instruction lives in a `_copy` block. Before we can use the data we
 * have to follow those instructions and build the real, complete entry.
 * That is what `resolveCopies()` below does.
 *
 * ADDING MORE CATEGORIES LATER
 * ----------------------------
 * Everything is split into small named functions. To add (say) spells later,
 * write an `extractSpells()` function modelled on `extractFeats()`, then add
 * one line calling it inside `main()` at the bottom. Nothing else changes.
 */

// `require` loads a built-in Node.js module. We use no third-party packages.
const fs = require("fs"); // "fs" = file system: reading and writing files.
const path = require("path"); // "path" = building file paths safely on any OS.

/* ============================================================================
 * SECTION 1 — CONFIGURATION
 * ----------------------------------------------------------------------------
 * Everything you are likely to want to change lives here at the top.
 * ==========================================================================*/

/*
 * Where the 5etools data lives. `__dirname` is the folder this script file is
 * in (that is `scripts/`), so ".." steps back up to the project root.
 * Note the doubled folder name — that is how the download is laid out.
 */
const SOURCE_DATA_DIR = path.join(
	__dirname,
	"..",
	"data-source",
	"5etools-src-main",
	"5etools-src-main",
	"data",
);

// Where our cleaned-up files get written. Created automatically if missing.
const OUTPUT_DIR = path.join(__dirname, "..", "data");

/*
 * Only entries from these books end up in our output. Everything else is
 * thrown away at the very END of processing (never at the start — see the
 * big comment on `resolveCopies` for why that matters).
 *
 * Add or remove book codes here to change what your app contains.
 */
const ALLOWED_SOURCES = [
	"XPHB", // Player's Handbook (2024)
	"XGE", // Xanathar's Guide to Everything
	"TCE", // Tasha's Cauldron of Everything
	"EFA", // Eberron: Forge of the Artificer
	"XDMG", // Dungeon Master's Guide (2024)
	"MPMM", // Mordenkainen Presents: Monsters of the Multiverse
];

/*
 * Which CLASS sources count as "a class my 2024 game actually uses".
 *
 * This is deliberately narrower than ALLOWED_SOURCES. A spell can be listed
 * against a 2014 class (classSource "PHB") as well as its 2024 replacement
 * (classSource "XPHB"); we only want the 2024 side. "EFA" is included because
 * that is where the 2024 Artificer lives.
 */
const ALLOWED_CLASS_SOURCES = ["XPHB", "EFA"];

/*
 * A `_copy` block says WHICH entry it wants to copy. It always gives a `name`
 * and a `source`, but for some categories that is not specific enough (there
 * can be several subclass features with the same name), so it may also give
 * some of these extra keys. We use whichever ones are present to find exactly
 * the right target.
 */
const COPY_MATCH_KEYS = [
	"shortName",
	"className",
	"classSource",
	"subclassShortName",
	"subclassSource",
	"level",
	"raceName",
	"raceSource",
];

/*
 * These keys are "bookkeeping" keys — page numbers, reprint pointers, and so
 * on. They describe the ORIGINAL entry, so they should NOT be inherited by a
 * copy by default; a copy sits on a different page of a different book.
 *
 * A `_copy` block can override that by listing a key inside `_preserve`,
 * which means "actually, do keep this one from the original".
 *
 * (This list mirrors 5etools' own `_MERGE_REQUIRES_PRESERVE_BASE` in
 * js/utils.js, so our behaviour matches theirs.)
 */
const PRESERVE_GATED_KEYS = [
	"page",
	"otherSources",
	"referenceSources",
	"srd",
	"srd52",
	"basicRules",
	"basicRules2024",
	"reprintedAs",
	"hasFluff",
	"hasFluffImages",
	"hasToken",
	"tokenCredit",
	"tokenCustom",
	"foundryTokenScale",
];

/*
 * The four `_mod` operations we support. These are the only ones that appear
 * in the character-building data we extract. If the data ever uses another
 * one, we print a loud warning rather than silently ignoring it.
 */
const SUPPORTED_MOD_MODES = ["appendArr", "prependArr", "insertArr", "replaceArr", "removeArr", "replaceTxt"];

/*
 * What each optional-feature `featureType` code means.
 *
 * Copied verbatim from 5etools' own legend: `Parser.OPT_FEATURE_TYPE_TO_FULL`
 * in js/parser.js (around line 2326). Do not invent entries here — if a new
 * code appears, copy its official wording across.
 */
const OPT_FEATURE_TYPE_TO_FULL = {
	"AI": "Artificer Infusion",
	"ED": "Elemental Discipline",
	"EI": "Eldritch Invocation",
	"MM": "Metamagic",
	"MV": "Maneuver",
	"MV:B": "Maneuver, Battle Master",
	"MV:C2-UA": "Maneuver, Cavalier V2 (UA)",
	"AS:V1-UA": "Arcane Shot, V1 (UA)",
	"AS:V2-UA": "Arcane Shot, V2 (UA)",
	"AS": "Arcane Shot",
	"OTH": "Other",
	"FS:F": "Fighting Style; Fighter",
	"FS:B": "Fighting Style; Bard",
	"FS:P": "Fighting Style; Paladin",
	"FS:R": "Fighting Style; Ranger",
	"PB": "Pact Boon",
	"OR": "Onomancy Resonant",
	"RN": "Rune Knight Rune",
	"AF": "Alchemical Formula",
	"TT": "Traveler's Trick",
	"RP": "Renown Perk",
};

/*
 * When a `_mod` uses the special property name "*", it means "apply this to
 * every one of these text-carrying properties". This list is copied from
 * 5etools' `COPY_ENTRY_PROPS`.
 */
const WILDCARD_MOD_PROPS = [
	"action",
	"bonus",
	"reaction",
	"trait",
	"legendary",
	"mythic",
	"variant",
	"spellcasting",
	"actionHeader",
	"bonusHeader",
	"reactionHeader",
	"legendaryHeader",
	"mythicHeader",
];

/*
 * When `replaceTxt` does not say which properties to search, these are the
 * defaults. `null` is not a typo — it means "the array's own string items".
 */
const DEFAULT_REPLACE_TXT_PROPS = [null, "entries", "headerEntries", "footerEntries"];

/* ============================================================================
 * SECTION 2 — SMALL GENERAL-PURPOSE HELPERS
 * ==========================================================================*/

/*
 * Makes a completely independent duplicate of a value.
 *
 * Why we need this: in JavaScript, if you write `const b = a` for an object,
 * `a` and `b` are two names for the SAME object — changing one changes the
 * other. When we build a copy of an entry we must not accidentally modify the
 * original. Converting to text and back is the simplest way to get a truly
 * separate duplicate, and it is safe here because this data is plain JSON.
 */
function deepClone(value) {
	return JSON.parse(JSON.stringify(value));
}

// Reads a JSON file from disk and turns it into a JavaScript value.
function readJson(filePath) {
	const text = fs.readFileSync(filePath, "utf8");
	return JSON.parse(text);
}

/*
 * Writes a JavaScript value to disk as nicely-indented JSON.
 * Returns the size of the written file in bytes, so we can report it.
 */
function writeJson(filePath, value) {
	// `null, "\t"` tells JSON.stringify to indent with tabs so the file is
	// readable if you open it. Remove it later if you want smaller files.
	const text = JSON.stringify(value, null, "\t");
	fs.writeFileSync(filePath, text, "utf8");
	return Buffer.byteLength(text, "utf8");
}

// Turns a raw byte count into something human-friendly like "1.4 MB".
function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/*
 * Some values in the data are single objects where an array is expected
 * (`items: {...}` instead of `items: [{...}]`). This normalises both shapes
 * into an array so the rest of the code only has to handle one case.
 */
function asArray(value) {
	if (value === undefined || value === null) return [];
	return Array.isArray(value) ? value : [value];
}

/*
 * `_mod` property names can be dotted paths like "entries.0.items".
 * These two helpers read and write a value at such a path.
 */
function getAtPath(obj, pathParts) {
	let current = obj;
	for (const part of pathParts) {
		if (current === undefined || current === null) return undefined;
		current = current[part];
	}
	return current;
}

function setAtPath(obj, pathParts, value) {
	let current = obj;
	// Walk to the second-to-last part, creating empty objects as needed.
	for (let i = 0; i < pathParts.length - 1; i++) {
		const part = pathParts[i];
		if (current[part] === undefined || current[part] === null) current[part] = {};
		current = current[part];
	}
	current[pathParts[pathParts.length - 1]] = value;
}

/*
 * Walks through a value (however deeply nested) and runs a text replacement
 * on every string it finds. Used by the `replaceTxt` mod mode.
 */
function replaceTextDeep(value, regex, replacement) {
	if (typeof value === "string") return value.replace(regex, replacement);
	if (Array.isArray(value)) return value.map((item) => replaceTextDeep(item, regex, replacement));
	if (value !== null && typeof value === "object") {
		const out = {};
		for (const [key, inner] of Object.entries(value)) {
			out[key] = replaceTextDeep(inner, regex, replacement);
		}
		return out;
	}
	// Numbers, booleans, null: nothing to replace, hand them back unchanged.
	return value;
}

/* ============================================================================
 * SECTION 3 — THE _copy RESOLVER
 * ==========================================================================*/

/*
 * Builds a lookup table so we can find an entry quickly by its name+source.
 *
 * The table maps "name|source" (lower-cased) to an ARRAY of entries, because
 * several entries really can share a name and source — for example the same
 * subclass listed once for 2014 rules and once for 2024 rules. We narrow
 * those down afterwards using the extra keys in COPY_MATCH_KEYS.
 */
function buildLookup(entries) {
	const lookup = new Map();
	for (const entry of entries) {
		const key = makeNameSourceKey(entry.name, entry.source);
		if (!lookup.has(key)) lookup.set(key, []);
		lookup.get(key).push(entry);
	}
	return lookup;
}

function makeNameSourceKey(name, source) {
	// Lower-casing means "Fireball|PHB" and "fireball|phb" find each other.
	return `${String(name).toLowerCase().trim()}|${String(source).toLowerCase().trim()}`;
}

/*
 * Given a `_copy` block, finds the single entry it is pointing at.
 * Returns the entry, or null if it could not be found.
 */
function findCopyTarget(copyBlock, lookup) {
	const candidates = lookup.get(makeNameSourceKey(copyBlock.name, copyBlock.source)) || [];
	if (candidates.length === 0) return null;
	if (candidates.length === 1) return candidates[0];

	// More than one entry shares this name+source, so use the extra keys
	// (className, level, etc.) that the `_copy` block gave us to pick one.
	const extraKeys = COPY_MATCH_KEYS.filter((key) => copyBlock[key] !== undefined);
	const narrowed = candidates.filter((candidate) =>
		extraKeys.every((key) => candidate[key] === copyBlock[key]),
	);

	if (narrowed.length === 1) return narrowed[0];
	// If narrowing failed or was ambiguous, fall back to the first candidate
	// rather than crashing — the caller records a warning about it.
	return narrowed[0] || candidates[0];
}

/*
 * Merges a resolved target entry with the entry that is copying from it.
 *
 * The rule is: start from the target, then lay the copier's own keys on top.
 * The copier's own keys always win, because they are the deliberate changes.
 */
function mergeCopy(targetEntry, copyingEntry) {
	const result = deepClone(targetEntry);

	// `_preserve` says which bookkeeping keys to keep from the target.
	const preserve = copyingEntry._copy._preserve || {};
	for (const key of PRESERVE_GATED_KEYS) {
		const isPreserved = preserve["*"] === true || preserve[key] === true;
		if (!isPreserved) delete result[key];
	}

	// The target might itself still carry copy instructions; ours replace them.
	delete result._copy;
	delete result._mod;

	// Now lay the copying entry's own keys over the top.
	for (const [key, value] of Object.entries(copyingEntry)) {
		if (key === "_copy") continue; // handled separately, never output
		// An explicit `null` means "delete this key from the result".
		if (value === null) {
			delete result[key];
			continue;
		}
		result[key] = deepClone(value);
	}

	return result;
}

/*
 * Applies one `_mod` operation to one property of an entry.
 * `warnings` is an array we push problem descriptions into.
 */
function applyOneMod(entry, propName, modInfo, label, warnings) {
	// A mod can be the plain string "remove" instead of an object. We do not
	// support that mode, so warn rather than guessing.
	if (typeof modInfo === "string") {
		warnings.push(`[${label}] "${entry.name}" (${entry.source}): unsupported _mod string mode "${modInfo}" on property "${propName}" — skipped.`);
		return;
	}

	const mode = modInfo.mode;
	if (!SUPPORTED_MOD_MODES.includes(mode)) {
		warnings.push(`[${label}] "${entry.name}" (${entry.source}): unsupported _mod mode "${mode}" on property "${propName}" — skipped.`);
		return;
	}

	const pathParts = propName.split("."); // supports dotted paths like "a.b"
	const existing = getAtPath(entry, pathParts);
	const items = asArray(modInfo.items).map((item) => deepClone(item));

	if (mode === "appendArr") {
		// Add the new items onto the END of the array.
		setAtPath(entry, pathParts, existing ? existing.concat(items) : items);
		return;
	}

	if (mode === "prependArr") {
		// Add the new items onto the START of the array.
		// Like appendArr (and unlike insertArr) a missing array is not an
		// error — the items simply become the whole array.
		setAtPath(entry, pathParts, existing ? items.concat(existing) : items);
		return;
	}

	if (mode === "insertArr") {
		// Put the new items in at a specific position.
		if (!Array.isArray(existing)) {
			warnings.push(`[${label}] "${entry.name}" (${entry.source}): insertArr found no array at "${propName}" — skipped.`);
			return;
		}
		// An index of -1 means "put them at the end".
		const index = modInfo.index >= 0 ? modInfo.index : existing.length;
		// splice(where, howManyToDelete, ...whatToInsert)
		existing.splice(index, 0, ...items);
		return;
	}

	if (mode === "replaceArr") {
		// Swap one existing array item out for the new item(s).
		if (!Array.isArray(existing)) {
			warnings.push(`[${label}] "${entry.name}" (${entry.source}): replaceArr found no array at "${propName}" — skipped.`);
			return;
		}

		const replace = modInfo.replace;
		let indexToReplace = -1;

		if (replace !== null && typeof replace === "object" && replace.regex) {
			// Find by regular expression against the item's name.
			const re = new RegExp(replace.regex, replace.flags || "");
			indexToReplace = existing.findIndex((item) =>
				item && item.name ? re.test(item.name) : typeof item === "string" ? re.test(item) : false,
			);
		} else if (replace !== null && typeof replace === "object" && replace.index !== undefined) {
			// Find by position.
			indexToReplace = replace.index;
		} else {
			// Find by exact name (or by the string itself, for string arrays).
			indexToReplace = existing.findIndex((item) =>
				item && item.name ? item.name === replace : item === replace,
			);
		}

		if (indexToReplace < 0) {
			warnings.push(`[${label}] "${entry.name}" (${entry.source}): replaceArr could not find "${JSON.stringify(replace)}" in "${propName}" — skipped.`);
			return;
		}
		existing.splice(indexToReplace, 1, ...items);
		return;
	}

	if (mode === "removeArr") {
		// Delete one or more items from an array.
		//
		// There are two ways of saying WHICH items to delete, and a mod uses
		// one or the other, never both:
		//
		//   names: ["Draconic Ancestry"]  -> delete the item whose `name`
		//                                    field matches
		//   items: ["longsword"]          -> delete the item that IS exactly
		//                                    this value (for plain-string
		//                                    arrays)
		//
		// Either one may be written as a single value instead of an array,
		// which is why we run them through `asArray`.
		//
		// Only the FIRST match is removed for each entry in the list — that
		// mirrors 5etools, which uses findIndex + a single splice.
		if (!Array.isArray(existing)) {
			warnings.push(`[${label}] "${entry.name}" (${entry.source}): removeArr found no array at "${propName}" — skipped.`);
			return;
		}

		if (modInfo.names !== undefined) {
			for (const nameToRemove of asArray(modInfo.names)) {
				const index = existing.findIndex((item) => item !== null && typeof item === "object" && item.name === nameToRemove);
				if (index >= 0) {
					existing.splice(index, 1);
				} else if (!modInfo.force) {
					// 5etools throws an error here unless the mod sets
					// `force: true`. We warn instead so one bad entry cannot
					// stop the whole extraction.
					warnings.push(`[${label}] "${entry.name}" (${entry.source}): removeArr could not find an item named "${nameToRemove}" in "${propName}" — nothing removed.`);
				}
				// When `force` is set, a missing item is expected — stay quiet.
			}
			return;
		}

		if (modInfo.items !== undefined) {
			for (const itemToRemove of asArray(modInfo.items)) {
				const index = existing.findIndex((item) => item === itemToRemove);
				if (index >= 0) {
					existing.splice(index, 1);
				} else {
					// This form has no `force` escape hatch in 5etools; a miss
					// is always an error there.
					warnings.push(`[${label}] "${entry.name}" (${entry.source}): removeArr could not find item ${JSON.stringify(itemToRemove)} in "${propName}" — nothing removed.`);
				}
			}
			return;
		}

		// Neither form was given, which 5etools treats as an error.
		warnings.push(`[${label}] "${entry.name}" (${entry.source}): removeArr on "${propName}" has neither "names" nor "items" — skipped.`);
		return;
	}

	if (mode === "replaceTxt") {
		// Find-and-replace text inside the entry's wording.
		if (!Array.isArray(existing)) {
			warnings.push(`[${label}] "${entry.name}" (${entry.source}): replaceTxt found no array at "${propName}" — skipped.`);
			return;
		}
		// "g" means replace EVERY occurrence, not just the first.
		const re = new RegExp(modInfo.replace, `g${modInfo.flags || ""}`);
		const withStr = modInfo.with;
		const targetProps = modInfo.props || DEFAULT_REPLACE_TXT_PROPS;

		// `null` in the props list means "the array's own plain-string items".
		if (targetProps.includes(null)) {
			setAtPath(
				entry,
				pathParts,
				existing.map((item) => (typeof item === "string" ? item.replace(re, withStr) : item)),
			);
		}

		// Then handle the named sub-properties of each object in the array.
		const refreshed = getAtPath(entry, pathParts);
		for (const item of refreshed) {
			if (item === null || typeof item !== "object") continue;
			for (const prop of targetProps) {
				if (prop === null) continue;
				if (item[prop] !== undefined) item[prop] = replaceTextDeep(item[prop], re, withStr);
			}
		}
	}
}

/*
 * Applies every operation inside a `_mod` block.
 */
function applyMods(entry, modBlock, label, warnings) {
	for (const [propName, rawModInfos] of Object.entries(modBlock)) {
		const modInfos = asArray(rawModInfos);

		// "*" means "do this to all the text-carrying properties".
		// "_" means a mod that targets no property at all — we don't support those.
		let propsToTouch;
		if (propName === "*") {
			propsToTouch = WILDCARD_MOD_PROPS.filter((prop) => entry[prop] !== undefined);
		} else if (propName === "_") {
			warnings.push(`[${label}] "${entry.name}" (${entry.source}): unsupported "_" (no-property) _mod — skipped.`);
			continue;
		} else {
			propsToTouch = [propName];
		}

		for (const modInfo of modInfos) {
			for (const prop of propsToTouch) {
				applyOneMod(entry, prop, modInfo, label, warnings);
			}
		}
	}
}

/*
 * THE MAIN RESOLVER.
 *
 * Takes the raw list of entries for one category and returns a new list where
 * every `_copy` instruction has been carried out.
 *
 * IMPORTANT — WHY WE DO NOT FILTER BY SOURCE FIRST:
 * A 2024 entry very often copies from a 2014 entry in a book we are NOT
 * keeping (PHB, DMG, SCAG...). If we filtered by source before resolving, the
 * thing being copied from would be gone and we would end up with empty
 * entries. So: load everything, resolve everything, and only filter at the
 * very end.
 */
function resolveCopies(rawEntries, label) {
	const warnings = [];
	const stats = { total: 0, copiesResolved: 0, copiesWithMod: 0, unresolvedTargets: 0, cycles: 0 };

	// Work on our own duplicate so the file we read is never touched.
	const entries = deepClone(rawEntries);
	stats.total = entries.length;

	const lookup = buildLookup(entries);

	// These remember which entries we have already dealt with. Using Sets of
	// the objects themselves means we never have to add marker keys to the
	// data (which would then leak into our output files).
	const finished = new Set(); // fully resolved
	const inProgress = new Set(); // currently being resolved — used to spot loops

	/*
	 * Resolves ONE entry, following its `_copy` chain as deep as it goes.
	 * It changes the entry in place, so anything else pointing at this same
	 * object sees the finished version too.
	 */
	function resolveEntry(entry) {
		if (finished.has(entry)) return; // already done

		// If we are asked to resolve something we are already in the middle of
		// resolving, the data contains a loop (A copies B, B copies A).
		if (inProgress.has(entry)) {
			stats.cycles++;
			warnings.push(`[${label}] CIRCULAR _copy detected involving "${entry.name}" (${entry.source}) — left unresolved.`);
			delete entry._copy;
			finished.add(entry);
			return;
		}

		// No copy instructions? Then there is nothing to do.
		if (!entry._copy) {
			finished.add(entry);
			return;
		}

		inProgress.add(entry);

		const copyBlock = entry._copy;
		const target = findCopyTarget(copyBlock, lookup);

		if (!target) {
			stats.unresolvedTargets++;
			warnings.push(`[${label}] "${entry.name}" (${entry.source}): could not find _copy target "${copyBlock.name}" (${copyBlock.source}) — left unresolved.`);
			delete entry._copy;
			inProgress.delete(entry);
			finished.add(entry);
			return;
		}

		// The target may itself be a copy of something else, so resolve it first.
		resolveEntry(target);

		// Build the merged result...
		const merged = mergeCopy(target, entry);

		// ...then apply the small changes described by `_mod`, if any.
		if (copyBlock._mod) {
			stats.copiesWithMod++;
			applyMods(merged, copyBlock._mod, label, warnings);
		}

		// `_copy` and `_mod` have now been carried out, so they must not appear
		// in our output files.
		delete merged._copy;
		delete merged._mod;

		/*
		 * Now write the merged result back into the SAME object. We empty the
		 * original object and refill it, rather than making a new one, so that
		 * any other entry already pointing at this object sees the update.
		 */
		for (const key of Object.keys(entry)) delete entry[key];
		Object.assign(entry, merged);

		stats.copiesResolved++;
		inProgress.delete(entry);
		finished.add(entry);
	}

	for (const entry of entries) resolveEntry(entry);

	return { entries, stats, warnings };
}

/* ============================================================================
 * SECTION 3b — THE _versions EXPANDER
 * ==========================================================================*/

/*
 * WHAT `_versions` IS
 * -------------------
 * Some entries are really several selectable options wearing a trench coat.
 * The 2024 feat "Magic Initiate" is one entry in the file, but a player
 * actually picks one of three real options: "Magic Initiate; Cleric",
 * "; Druid" or "; Wizard".
 *
 * The file stores that as a `_versions` array on the parent entry. Each item
 * in that array describes ONE variant by saying how it differs from the
 * parent, using the very same `_mod` operations we already support.
 *
 * WHAT WE DO WITH IT
 * ------------------
 * We keep the parent AND add every variant as its own top-level entry.
 * That is exactly what 5etools itself does — see
 * js/utils-dataloader/utils-dataloader-dataloader.js, where each entry is
 * added to the list and then every one of its versions is added too.
 *
 * WHAT WE DELIBERATELY DO NOT DO
 * ------------------------------
 * A version can instead be written as an `_abstract` template plus a list of
 * `_implementations` (used by Dragonborn in races.json, which stamps out one
 * variant per dragon colour). That is a different mechanism, it needs
 * {{variable}} substitution and extra `_mod` modes we do not support, so we
 * skip it and print a warning rather than guessing at it.
 */

// Keys that belong to the version's own instructions and must never be
// copied onto the finished variant as ordinary data.
const VERSION_INSTRUCTION_KEYS = ["_mod", "_preserve", "_templates", "_abstract", "_implementations", "_variables"];

/*
 * Fills in {{placeholder}} markers inside a template.
 *
 * The 2024 Dragonborn is stored once as a template whose name is
 * "Dragonborn ({{color}})", plus a list of implementations each supplying
 * `_variables: {color: "Black", damageType: "Acid"}`. Stamping the template
 * out once per implementation gives the ten real dragonborn species.
 *
 * Two details worth knowing, both checked against 5etools' own walker
 * (MiscUtil._WalkerSync._doObjectRecurse in js/utils.js):
 *
 *   - Placeholders are replaced in strings ANYWHERE inside the template,
 *     however deeply nested in objects and arrays.
 *   - Object KEYS are never substituted. The walker recurses into `obj[k]`
 *     and writes the result back under the same `k`, so a key containing
 *     "{{...}}" would be left alone. We match that behaviour.
 */
function substituteTemplateVariables(value, variables, missingNames) {
	if (typeof value === "string") {
		// The pattern finds every {{name}} marker in the string.
		return value.replace(/{{([^}]+)}}/g, (whole, variableName) => {
			if (!Object.prototype.hasOwnProperty.call(variables, variableName)) {
				// 5etools would silently insert the text "undefined" here.
				// We keep the marker and report it instead, so a typo in the
				// data is visible rather than baked into the output.
				missingNames.add(variableName);
				return whole;
			}
			return variables[variableName];
		});
	}

	if (Array.isArray(value)) {
		return value.map((item) => substituteTemplateVariables(item, variables, missingNames));
	}

	if (value !== null && typeof value === "object") {
		const out = {};
		for (const [key, inner] of Object.entries(value)) {
			// NOTE: `key` is copied across untouched — keys are not templated.
			out[key] = substituteTemplateVariables(inner, variables, missingNames);
		}
		return out;
	}

	return value;
}

/*
 * Turns one `_abstract` + `_implementations` pair into a list of ordinary
 * version descriptions, which the normal version machinery can then build.
 *
 * Mirrors `_getVersions_template` in js/utils.js: clone the template,
 * substitute the implementation's variables into it, then lay the
 * implementation's own real keys over the top (a shallow, top-level merge,
 * exactly like the reference's `Object.assign`).
 */
function expandAbstractTemplate(versionInfo, parentEntry, label, warnings) {
	const built = [];

	for (const implementation of versionInfo._implementations) {
		const variables = implementation._variables || {};
		const missingNames = new Set();

		let filled = substituteTemplateVariables(versionInfo._abstract, variables, missingNames);

		if (missingNames.size) {
			warnings.push(`[${label}] "${parentEntry.name}" (${parentEntry.source}): template placeholder(s) ${[...missingNames].map((n) => `{{${n}}}`).join(", ")} had no matching _variables value — left as-is.`);
		}

		// An implementation should only supply values and plain data. If it
		// tried to bring its own `_mod` it would silently replace the
		// template's, so say something rather than quietly doing that.
		if (implementation._mod) {
			warnings.push(`[${label}] "${parentEntry.name}" (${parentEntry.source}): an _implementation carries its own "_mod", which is not supported — the template's _mod is used instead.`);
		}

		// Lay the implementation's own real keys (e.g. `resist`) over the
		// filled-in template. Top level only, matching the reference.
		for (const [key, value] of Object.entries(implementation)) {
			if (key === "_variables" || key === "_mod") continue;
			filled[key] = deepClone(value);
		}

		built.push(filled);
	}

	return built;
}

/*
 * Builds ONE finished variant from a parent entry and one `_versions` item.
 */
function buildOneVersion(parentEntry, versionInfo, label, warnings) {
	// Start from the parent, minus its own version list (a variant of a
	// variant is not a thing) ...
	const base = deepClone(parentEntry);
	delete base._versions;

	// ... and minus the parent's flavour-text/token flags. Those describe the
	// parent's own artwork and blurb, which the variant does not have.
	// (5etools does the same in its `_getVersion`.)
	delete base.hasFluff;
	delete base.hasFluffImages;
	delete base.hasToken;

	/*
	 * We already have machinery that merges one entry onto another and then
	 * applies `_mod` operations: the `_copy` code. So we build a small
	 * stand-in entry shaped the way `mergeCopy` expects, and reuse it.
	 *
	 * Note the `_preserve` default of `{"*": true}`. For a normal `_copy` the
	 * bookkeeping keys (page, srd, reprintedAs...) are dropped unless asked
	 * for. For a version they are KEPT by default, because a version lives on
	 * the same page of the same book as its parent. This matches 5etools.
	 */
	const standIn = { _copy: { _preserve: versionInfo._preserve || { "*": true } } };
	for (const [key, value] of Object.entries(versionInfo)) {
		if (VERSION_INSTRUCTION_KEYS.includes(key)) continue; // instructions, not data
		standIn[key] = value;
	}

	const variant = mergeCopy(base, standIn);

	// Now apply the version's own `_mod` changes, if it has any.
	if (versionInfo._mod) {
		applyMods(variant, versionInfo._mod, label, warnings);
	}

	// None of the instruction keys may survive into the output.
	delete variant._versions;
	delete variant._copy;
	delete variant._mod;
	delete variant._abstract;
	delete variant._implementations;
	delete variant._variables;

	return variant;
}

/*
 * Walks a whole category and expands every `_versions` array it finds.
 *
 * Returns a NEW list containing every original entry (parents included) plus
 * all the variants those parents spawned.
 */
function expandVersions(entries, label) {
	const warnings = [];
	const stats = { parentsExpanded: 0, variantsCreated: 0, templatesExpanded: 0 };
	const output = [];

	for (const entry of entries) {
		// Entries without `_versions` pass straight through untouched.
		if (!Array.isArray(entry._versions) || entry._versions.length === 0) {
			output.push(entry);
			continue;
		}

		const versionInfos = entry._versions;

		// The parent itself stays selectable, so it goes into the output too —
		// but without its now-expanded `_versions` list.
		const parentCopy = deepClone(entry);
		delete parentCopy._versions;
		output.push(parentCopy);

		let builtAny = false;
		for (const versionInfo of versionInfos) {
			if (versionInfo._templates) {
				warnings.push(`[${label}] "${entry.name}" (${entry.source}): a _versions entry uses the unsupported "_templates" form — SKIPPED.`);
				continue;
			}

			/*
			 * A version comes in one of two forms:
			 *
			 *   plain     — describes a single variant directly.
			 *   template  — an `_abstract` blueprint plus a list of
			 *               `_implementations`, which together describe
			 *               several variants at once (one per implementation).
			 *
			 * We turn the template form into a list of plain ones, then build
			 * them all the same way.
			 */
			let plainVersions;
			if (versionInfo._abstract && versionInfo._implementations) {
				plainVersions = expandAbstractTemplate(versionInfo, entry, label, warnings);
				stats.templatesExpanded++;
			} else if (versionInfo._abstract || versionInfo._implementations) {
				// One without the other is malformed — say so rather than guess.
				warnings.push(`[${label}] "${entry.name}" (${entry.source}): a _versions entry has "_abstract" or "_implementations" but not both — SKIPPED.`);
				continue;
			} else {
				plainVersions = [versionInfo];
			}

			for (const plainVersion of plainVersions) {
				output.push(buildOneVersion(entry, plainVersion, label, warnings));
				stats.variantsCreated++;
				builtAny = true;
			}
		}

		if (builtAny) stats.parentsExpanded++;
	}

	return { entries: output, stats, warnings };
}

/* ============================================================================
 * SECTION 3c — THE SHARED PIPELINE
 * ==========================================================================*/

/*
 * Every category goes through exactly the same preparation:
 *
 *   1. resolve `_copy`     (build entries that inherit from other entries)
 *   2. expand `_versions`  (turn one entry into its several real options)
 *
 * The order matters: an entry can INHERIT a `_versions` list through a
 * `_copy`, so copies have to be resolved first or those inherited versions
 * would never be seen.
 *
 * Filtering by source deliberately does NOT happen here — it happens in each
 * extractor, at the very end, for the reason explained on `resolveCopies`.
 */
function prepareEntries(rawEntries, label) {
	const copyResult = resolveCopies(rawEntries, label);
	const versionResult = expandVersions(copyResult.entries, label);

	return {
		entries: versionResult.entries,
		copyStats: copyResult.stats,
		versionStats: versionResult.stats,
		warnings: [...copyResult.warnings, ...versionResult.warnings],
	};
}

/* ============================================================================
 * SECTION 4 — CATEGORY EXTRACTORS
 * ----------------------------------------------------------------------------
 * One function per category. Add new ones here as you go.
 * ==========================================================================*/

/*
 * FEATS
 *
 * Reads the source feats.json, resolves copies, keeps only allowed sources,
 * fills in a missing `category`, and writes data/feats.json.
 */
function extractFeats() {
	console.log("\n--- FEATS ---");

	const sourceFile = path.join(SOURCE_DATA_DIR, "feats.json");
	const rawFeats = readJson(sourceFile).feat;

	// Step 1: run the shared pipeline — resolve `_copy`, then expand `_versions`.
	const { entries: resolved, copyStats, versionStats, warnings } = prepareEntries(rawFeats, "feats");

	console.log(`Loaded before filtering:      ${copyStats.total}`);
	console.log(`_copy blocks resolved:        ${copyStats.copiesResolved}`);
	console.log(`  ...of which had a _mod:     ${copyStats.copiesWithMod}`);
	console.log(`Entries expanded by _versions: ${versionStats.parentsExpanded}`);
	console.log(`  ...into variants:           ${versionStats.variantsCreated}`);

	// Step 2: NOW filter by source (never before resolving — see resolveCopies).
	const kept = resolved.filter((feat) => ALLOWED_SOURCES.includes(feat.source));

	// Step 3: fill in a missing category.
	// 2024 feats have a `category`: "O" origin, "G" general, "FS" fighting
	// style, "EB" epic boon. Feats from the older XGE and TCE predate that
	// system and have no category at all. Under 2024 rules they behave as
	// general feats, so that is what we label them.
	let categoryDefaulted = 0;
	for (const feat of kept) {
		if (feat.category === undefined || feat.category === null) {
			feat.category = "G";
			categoryDefaulted++;
		}
	}

	// Step 4: report what survived, grouped by book.
	const bySource = {};
	for (const feat of kept) bySource[feat.source] = (bySource[feat.source] || 0) + 1;

	console.log(`Passed the source filter:     ${kept.length}`);
	for (const source of Object.keys(bySource).sort()) {
		console.log(`    ${source.padEnd(6)} ${bySource[source]}`);
	}
	console.log(`Category defaulted to "G":    ${categoryDefaulted}`);

	// Step 5: write the file.
	const outputFile = path.join(OUTPUT_DIR, "feats.json");
	const bytes = writeJson(outputFile, kept);
	console.log(`Wrote: ${outputFile}`);
	console.log(`Size:  ${formatBytes(bytes)}`);

	return warnings;
}

/*
 * SPELLS
 *
 * Spell files are split one-per-sourcebook, and `index.json` maps a source
 * code to its filename. We read that index rather than hardcoding filenames,
 * so if a book in ALLOWED_SOURCES ever gains a spell file it is picked up
 * automatically with no code change.
 */

/*
 * Spell entries do NOT record which classes can cast them. That information
 * lives in a separate generated file, organised as:
 *
 *   [bookCodeLowercase][spellNameLowercase] -> { class, classVariant,
 *                                                subclass, feat,
 *                                                optionalfeature, ... }
 *
 * This function reads each of those sub-trees and turns them into a tidy
 * `availableTo` object for one spell.
 *
 * The sub-trees are nested by SOURCE first, which is what lets us keep only
 * the 2024 entries.
 */
function buildSpellAvailability(spell, lookup) {
	// We always attach all five lists, even when empty, so every spell has the
	// same shape and your app never has to check whether a key exists.
	const availableTo = {
		classes: [],
		classVariants: [],
		subclasses: [],
		feats: [],
		optionalFeatures: [],
	};

	const bookTree = lookup[String(spell.source).toLowerCase()];
	const spellTree = bookTree ? bookTree[String(spell.name).toLowerCase()] : undefined;
	if (!spellTree) return availableTo; // no entry at all — nothing can cast it

	/*
	 * `class` and `classVariant` have the same shape:
	 *     { classSource: { className: true | { definedInSources: [...] } } }
	 *
	 * They are kept in SEPARATE lists because 5etools treats them very
	 * differently when it renders a spell (see js/render.js around line 7566):
	 *   - `class`        is printed as "Classes:"
	 *   - `classVariant` is printed as "Optional/Variant Classes:"
	 * The second means the spell is only on that class's list through an
	 * optional rule the DM has to allow, so merging them would overstate what
	 * a character can actually take.
	 */
	for (const [treeName, outputKey] of [["class", "classes"], ["classVariant", "classVariants"]]) {
		const tree = spellTree[treeName];
		if (!tree) continue;

		for (const [classSource, classMap] of Object.entries(tree)) {
			if (!ALLOWED_CLASS_SOURCES.includes(classSource)) continue;

			for (const [className, value] of Object.entries(classMap)) {
				const record = { name: className, classSource };
				// `definedInSources` records which book granted this listing —
				// e.g. a Fizban's rule adding a spell to the Ranger list.
				if (value !== true && value && value.definedInSources) {
					record.definedInSources = [...value.definedInSources];
				}
				availableTo[outputKey].push(record);
			}
		}
	}

	/*
	 * `subclass` is nested one level deeper:
	 *   { classSource: { className: { subclassSource: { shortName: {name} } } } }
	 * The innermost value carries the subclass's full display name, and
	 * sometimes a `subSubclasses` list (for things like the Genie warlock's
	 * Efreeti option).
	 */
	if (spellTree.subclass) {
		for (const [classSource, classMap] of Object.entries(spellTree.subclass)) {
			/*
			 * THE TWO SOURCE FIELDS MEAN DIFFERENT THINGS — do not swap them.
			 *
			 *   classSource     = which EDITION of the class this is.
			 *                     "PHB" is the 2014 Fighter, "XPHB" is the
			 *                     2024 Fighter. We only want 2024 classes, so
			 *                     this is filtered against
			 *                     ALLOWED_CLASS_SOURCES (XPHB, EFA).
			 *
			 *   subclassSource  = which BOOK the subclass was printed in.
			 *                     Aberrant Mind comes from TCE, Arcane Archer
			 *                     from XGE, and both are perfectly legal in a
			 *                     2024 game. So this is filtered against the
			 *                     normal book allowlist, ALLOWED_SOURCES.
			 *
			 * Filtering subclassSource against ALLOWED_CLASS_SOURCES would
			 * silently throw away every XGE and TCE subclass.
			 */
			if (!ALLOWED_CLASS_SOURCES.includes(classSource)) continue;

			for (const [className, subclassSourceMap] of Object.entries(classMap)) {
				for (const [subclassSource, subclassMap] of Object.entries(subclassSourceMap)) {
					if (!ALLOWED_SOURCES.includes(subclassSource)) continue;

					for (const [shortName, info] of Object.entries(subclassMap)) {
						const record = {
							className,
							classSource,
							subclassName: (info && info.name) || shortName,
							subclassShortName: shortName,
							subclassSource,
						};
						if (info && info.subSubclasses) record.subSubclasses = [...info.subSubclasses];
						availableTo.subclasses.push(record);
					}
				}
			}
		}
	}

	// `feat` is { featSource: { featName: true } }
	if (spellTree.feat) {
		for (const [source, featMap] of Object.entries(spellTree.feat)) {
			if (!ALLOWED_SOURCES.includes(source)) continue;
			for (const featName of Object.keys(featMap)) {
				availableTo.feats.push({ name: featName, source });
			}
		}
	}

	// `optionalfeature` is { source: { name: { featureType: [...] } } }
	// (featureType "EI" = Eldritch Invocation, "FS" = Fighting Style, etc.)
	if (spellTree.optionalfeature) {
		for (const [source, featureMap] of Object.entries(spellTree.optionalfeature)) {
			if (!ALLOWED_SOURCES.includes(source)) continue;
			for (const [featureName, info] of Object.entries(featureMap)) {
				const record = { name: featureName, source };
				if (info && info.featureType) record.featureType = [...info.featureType];
				availableTo.optionalFeatures.push(record);
			}
		}
	}

	return availableTo;
}

function extractSpells() {
	console.log("\n--- SPELLS ---");

	const spellsDir = path.join(SOURCE_DATA_DIR, "spells");
	const index = readJson(path.join(spellsDir, "index.json"));

	// Keep only the books we care about. Reading the index (rather than
	// listing filenames ourselves) means a newly-added book is picked up
	// automatically, and a book with no spell file is simply absent.
	const booksToLoad = Object.entries(index).filter(([source]) => ALLOWED_SOURCES.includes(source));

	const skipped = ALLOWED_SOURCES.filter((source) => !index[source]);
	console.log(`Spell files found for:        ${booksToLoad.map(([source]) => source).join(", ")}`);
	if (skipped.length) console.log(`No spell file (skipped):      ${skipped.join(", ")}`);

	// Load every allowed book's spells into one big list.
	const rawSpells = [];
	for (const [, fileName] of booksToLoad) {
		const data = readJson(path.join(spellsDir, fileName));
		rawSpells.push(...(data.spell || []));
	}

	// Same shared pipeline as every other category.
	const { entries: resolved, copyStats, versionStats, warnings } = prepareEntries(rawSpells, "spells");

	console.log(`Loaded before filtering:      ${copyStats.total}`);
	console.log(`_copy blocks resolved:        ${copyStats.copiesResolved}`);
	console.log(`  ...of which had a _mod:     ${copyStats.copiesWithMod}`);
	console.log(`Entries expanded by _versions: ${versionStats.parentsExpanded}`);
	console.log(`  ...into variants:           ${versionStats.variantsCreated}`);

	// Filter by source last, as always.
	const kept = resolved.filter((spell) => ALLOWED_SOURCES.includes(spell.source));

	// Attach the class-availability information.
	const lookup = readJson(path.join(SOURCE_DATA_DIR, "generated", "gendata-spell-source-lookup.json"));
	let noClassCount = 0;
	for (const spell of kept) {
		spell.availableTo = buildSpellAvailability(spell, lookup);
		if (spell.availableTo.classes.length === 0) noClassCount++;
	}

	const bySource = {};
	for (const spell of kept) bySource[spell.source] = (bySource[spell.source] || 0) + 1;

	console.log(`Passed the source filter:     ${kept.length}`);
	for (const source of Object.keys(bySource).sort()) {
		console.log(`    ${source.padEnd(6)} ${bySource[source]}`);
	}
	console.log(`Spells no 2024 class can learn: ${noClassCount}`);

	const outputFile = path.join(OUTPUT_DIR, "spells.json");
	const bytes = writeJson(outputFile, kept);
	console.log(`Wrote: ${outputFile}`);
	console.log(`Size:  ${formatBytes(bytes)}`);

	return warnings;
}

/*
 * SPECIES (called "races" in the source data)
 *
 * races.json holds two lists:
 *   race    — 160 entries, the main species list.
 *   subrace — 98 entries, sub-options attached to a parent race by
 *             `raceName` + `raceSource`.
 *
 * Almost all subraces are 2014-era, because 2024 species fold their options
 * into the main entry. We still need the list, though: MPMM keeps four
 * Genasi subraces (Air, Earth, Fire, Water) that would otherwise be lost.
 * Both lists are loaded together so `_copy` targets resolve across them.
 */
function extractSpecies() {
	console.log("\n--- SPECIES ---");

	const data = readJson(path.join(SOURCE_DATA_DIR, "races.json"));
	const rawSpecies = [...(data.race || []), ...(data.subrace || [])];
	console.log(`Loaded "race" entries:        ${(data.race || []).length}`);
	console.log(`Loaded "subrace" entries:     ${(data.subrace || []).length}`);

	const { entries: resolved, copyStats, versionStats, warnings } = prepareEntries(rawSpecies, "species");

	console.log(`Loaded before filtering:      ${copyStats.total}`);
	console.log(`_copy blocks resolved:        ${copyStats.copiesResolved}`);
	console.log(`  ...of which had a _mod:     ${copyStats.copiesWithMod}`);
	console.log(`Entries expanded by _versions: ${versionStats.parentsExpanded}`);
	console.log(`  ...of those, templates:     ${versionStats.templatesExpanded}`);
	console.log(`  ...into variants:           ${versionStats.variantsCreated}`);

	/*
	 * Keep an entry if EITHER:
	 *   - it is 2024 content (`edition: "one"`) from a book we allow, OR
	 *   - it comes from MPMM.
	 *
	 * MPMM gets its own clause because it is tagged as 2014-era ("classic")
	 * even though it is the modern home of most playable species.
	 *
	 * Note this correctly drops RHW: it is `edition: "one"` but is not in
	 * ALLOWED_SOURCES, so it fails both halves of the test.
	 */
	const kept = resolved.filter(
		(entry) => (entry.edition === "one" && ALLOWED_SOURCES.includes(entry.source)) || entry.source === "MPMM",
	);

	/*
	 * Under 2024 rules, ability score increases come from your BACKGROUND,
	 * never from your species. An `ability` field left on an MPMM entry could
	 * be applied on top of the background's, double-counting the bonus, so we
	 * remove it.
	 */
	let abilityStripped = 0;
	for (const entry of kept) {
		if (entry.source === "MPMM" && entry.ability !== undefined) {
			delete entry.ability;
			abilityStripped++;
		}
	}

	// Sanity check: 2024 species should never have carried an `ability` field.
	const unexpectedAbility = kept.filter((entry) => entry.ability !== undefined);
	if (unexpectedAbility.length) {
		warnings.push(`[species] ${unexpectedAbility.length} non-MPMM entr(ies) unexpectedly have an "ability" field, e.g. "${unexpectedAbility[0].name}" (${unexpectedAbility[0].source}).`);
	}

	const bySource = {};
	for (const entry of kept) bySource[entry.source] = (bySource[entry.source] || 0) + 1;

	console.log(`Passed the source filter:     ${kept.length}`);
	for (const source of Object.keys(bySource).sort()) {
		console.log(`    ${source.padEnd(6)} ${bySource[source]}`);
	}
	console.log(`MPMM "ability" fields removed: ${abilityStripped}`);

	const outputFile = path.join(OUTPUT_DIR, "species.json");
	const bytes = writeJson(outputFile, kept);
	console.log(`Wrote: ${outputFile}`);
	console.log(`Size:  ${formatBytes(bytes)}`);

	return warnings;
}

/*
 * BACKGROUNDS
 *
 * Under 2024 rules the background carries far more mechanical weight than it
 * used to. It is where a character gets:
 *
 *   ability            — the ability score increases (+2/+1 or +1/+1/+1)
 *   feats              — the origin feat
 *   skillProficiencies — two skills
 *   toolProficiencies  — one tool
 *   startingEquipment  — a choice between an equipment pack (A) or coins (B)
 *
 * Those fields are written out EXACTLY as they appear in the source. They
 * use 5etools' own "choose" structures, which are fiddly but lossless; a
 * flattened version would quietly throw away the player's choices.
 */
function extractBackgrounds() {
	console.log("\n--- BACKGROUNDS ---");

	const sourceFile = path.join(SOURCE_DATA_DIR, "backgrounds.json");
	const rawBackgrounds = readJson(sourceFile).background;

	const { entries: resolved, copyStats, versionStats, warnings } = prepareEntries(rawBackgrounds, "backgrounds");

	console.log(`Loaded before filtering:      ${copyStats.total}`);
	console.log(`_copy blocks resolved:        ${copyStats.copiesResolved}`);
	console.log(`  ...of which had a _mod:     ${copyStats.copiesWithMod}`);
	console.log(`Entries expanded by _versions: ${versionStats.parentsExpanded}`);
	console.log(`  ...into variants:           ${versionStats.variantsCreated}`);

	const kept = resolved.filter((background) => ALLOWED_SOURCES.includes(background.source));

	const bySource = {};
	for (const background of kept) bySource[background.source] = (bySource[background.source] || 0) + 1;

	console.log(`Passed the source filter:     ${kept.length}`);
	for (const source of Object.keys(bySource).sort()) {
		console.log(`    ${source.padEnd(6)} ${bySource[source]}`);
	}

	// The five character-building fields matter enough to be worth counting,
	// so a future book with an incomplete entry is noticed straight away.
	const KEY_FIELDS = ["ability", "feats", "skillProficiencies", "toolProficiencies", "startingEquipment"];
	for (const field of KEY_FIELDS) {
		const have = kept.filter((background) => background[field] !== undefined).length;
		console.log(`    has "${field}"`.padEnd(30) + `${have}/${kept.length}`);
	}

	const outputFile = path.join(OUTPUT_DIR, "backgrounds.json");
	const bytes = writeJson(outputFile, kept);
	console.log(`Wrote: ${outputFile}`);
	console.log(`Size:  ${formatBytes(bytes)}`);

	return warnings;
}

/* ============================================================================
 * SECTION 4b — CLASS FEATURE REFERENCES ("uids")
 * ----------------------------------------------------------------------------
 * A class does not contain its features' text. It lists them as
 * pipe-delimited reference strings, and the real text lives in a separate
 * list. These helpers turn a reference into a stable `id` so both sides can
 * be matched with a simple lookup.
 *
 * FIELD ORDER (matches DataUtil.class.unpackUidClassFeature and
 * unpackUidSubclassFeature in js/utils.js, ~line 7471):
 *
 *   class feature:
 *     name | className | classSource | level | source | displayText
 *
 *   subclass feature:
 *     name | className | classSource | subclassShortName | subclassSource
 *          | level | source | displayText
 *
 * THE BLANK-FIELD RULES ARE THE EASY PART TO GET WRONG:
 *   - a blank `classSource` means "PHB" — NOT "the same source as the class"
 *   - a blank `subclassSource` means "PHB" likewise
 *   - a blank `source` means "the same as classSource / subclassSource",
 *     after those have themselves been defaulted
 *   - `displayText` is presentation only and is ignored for matching
 *
 * So "Second Wind|Fighter||1" refers to the 2014 PHB fighter, while the 2024
 * class writes it out in full as "Second Wind|Fighter|XPHB|1".
 * ==========================================================================*/

// Lower-cases and trims one piece of an id so matching is case-insensitive.
function idPart(value) {
	return String(value === undefined || value === null ? "" : value).trim().toLowerCase();
}

/*
 * The id format is the reference's own fields, defaulted, lower-cased, and
 * joined with "|", behind a short tag saying which kind of feature it is:
 *
 *   cf|<name>|<className>|<classSource>|<level>|<source>
 *   scf|<name>|<className>|<classSource>|<subclassShortName>|<subclassSource>|<level>|<source>
 *
 * Why this shape: it uses exactly the fields 5etools itself uses to identify
 * a feature, so it is guaranteed unique (verified: 677 class features and
 * 1441 subclass features produce zero duplicate ids), and it can be built
 * from BOTH sides — from a reference string, and from a feature entry's own
 * fields — giving identical results. The "cf"/"scf" tag keeps the two kinds
 * from ever colliding.
 */
function makeClassFeatureIdFromRef(uid) {
	let [name, className, classSource, level, source] = String(uid).split("|").map((part) => part.trim());
	classSource = classSource || "PHB"; // blank means PHB, not "this class"
	source = source || classSource; // blank means "same as the class"
	return ["cf", idPart(name), idPart(className), idPart(classSource), idPart(level), idPart(source)].join("|");
}

function makeSubclassFeatureIdFromRef(uid) {
	let [name, className, classSource, subclassShortName, subclassSource, level, source] = String(uid)
		.split("|")
		.map((part) => part.trim());
	classSource = classSource || "PHB";
	subclassSource = subclassSource || "PHB";
	source = source || subclassSource; // blank means "same as the subclass"
	return [
		"scf",
		idPart(name),
		idPart(className),
		idPart(classSource),
		idPart(subclassShortName),
		idPart(subclassSource),
		idPart(level),
		idPart(source),
	].join("|");
}

// The same two ids, built from a feature entry's own fields.
function makeClassFeatureIdFromEntry(entry) {
	return ["cf", idPart(entry.name), idPart(entry.className), idPart(entry.classSource), idPart(entry.level), idPart(entry.source)].join("|");
}

function makeSubclassFeatureIdFromEntry(entry) {
	return [
		"scf",
		idPart(entry.name),
		idPart(entry.className),
		idPart(entry.classSource),
		idPart(entry.subclassShortName),
		idPart(entry.subclassSource),
		idPart(entry.level),
		idPart(entry.source),
	].join("|");
}

/*
 * A class's `classFeatures` list mixes plain strings with objects that carry
 * extra flags, e.g. {classFeature: "...", gainSubclassFeature: true}. This
 * pulls the reference string out of either shape.
 */
function getReferenceString(reference) {
	if (typeof reference === "string") return reference;
	if (reference && typeof reference === "object") return reference.classFeature || reference.subclassFeature;
	return undefined;
}

/*
 * CLASSES, SUBCLASSES AND THEIR FEATURES
 *
 * Every class file is loaded, not just the ones we intend to keep, because
 * `_copy` references cross file boundaries constantly (class-cleric.json
 * alone contains 56). Filtering happens only after everything is resolved.
 */
function extractClasses() {
	console.log("\n--- CLASSES ---");

	const classDir = path.join(SOURCE_DATA_DIR, "class");
	const index = readJson(path.join(classDir, "index.json"));
	const fileNames = Object.values(index);
	console.log(`Class files in index.json:    ${fileNames.length}`);

	// Gather each kind of entry into its own list.
	const raw = { class: [], subclass: [], classFeature: [], subclassFeature: [] };
	for (const fileName of fileNames) {
		const data = readJson(path.join(classDir, fileName));
		for (const listName of Object.keys(raw)) {
			if (Array.isArray(data[listName])) raw[listName].push(...data[listName]);
		}
	}
	console.log(`Loaded: ${raw.class.length} classes, ${raw.subclass.length} subclasses, ${raw.classFeature.length} class features, ${raw.subclassFeature.length} subclass features`);

	/*
	 * Each list goes through the pipeline SEPARATELY. Running them together
	 * would put a subclass named "Battle Master" and a subclass feature also
	 * named "Battle Master" in the same lookup, where a `_copy` could match
	 * the wrong one.
	 */
	const warnings = [];
	const totals = { copiesResolved: 0, copiesWithMod: 0, parentsExpanded: 0, variantsCreated: 0 };
	const prepared = {};
	for (const listName of Object.keys(raw)) {
		const result = prepareEntries(raw[listName], `class:${listName}`);
		prepared[listName] = result.entries;
		totals.copiesResolved += result.copyStats.copiesResolved;
		totals.copiesWithMod += result.copyStats.copiesWithMod;
		totals.parentsExpanded += result.versionStats.parentsExpanded;
		totals.variantsCreated += result.versionStats.variantsCreated;
		warnings.push(...result.warnings);
	}
	console.log(`_copy blocks resolved:        ${totals.copiesResolved}`);
	console.log(`  ...of which had a _mod:     ${totals.copiesWithMod}`);
	console.log(`Entries expanded by _versions: ${totals.parentsExpanded} into ${totals.variantsCreated}`);

	/*
	 * CLASSES: the 2024 core classes (XPHB) plus the Artificer, whose 2024
	 * version lives in EFA.
	 */
	const keptClasses = prepared.class.filter((entry) => ALLOWED_CLASS_SOURCES.includes(entry.source));

	/*
	 * SUBCLASSES: both conditions must hold. See the long comment in
	 * `buildSpellAvailability` — these two fields mean different things and
	 * swapping them silently deletes every XGE and TCE subclass.
	 *
	 *   classSource = the class EDITION it attaches to  -> XPHB / EFA
	 *   source      = the BOOK it was printed in        -> ALLOWED_SOURCES
	 */
	const keptSubclasses = prepared.subclass.filter(
		(entry) => ALLOWED_CLASS_SOURCES.includes(entry.classSource) && ALLOWED_SOURCES.includes(entry.source),
	);

	// Give EVERY feature its stable id first, so we can match against them.
	for (const entry of prepared.classFeature) entry.id = makeClassFeatureIdFromEntry(entry);
	for (const entry of prepared.subclassFeature) entry.id = makeSubclassFeatureIdFromEntry(entry);

	/*
	 * Give each class and subclass a matching list of ids, alongside — never
	 * replacing — the original reference strings.
	 */
	for (const entry of keptClasses) {
		entry.classFeatureIds = (entry.classFeatures || [])
			.map(getReferenceString)
			.filter(Boolean)
			.map(makeClassFeatureIdFromRef);
	}
	for (const entry of keptSubclasses) {
		entry.subclassFeatureIds = (entry.subclassFeatures || [])
			.map(getReferenceString)
			.filter(Boolean)
			.map(makeSubclassFeatureIdFromRef);
	}

	/*
	 * FEATURES: a feature is kept when a surviving class or subclass actually
	 * REFERENCES it — never by looking at the feature's own source.
	 *
	 * Matching on the feature's own owner fields instead looks tempting, but
	 * it is wrong. The EFA Artificer's subclasses are `_copy`-derived from
	 * their TCE originals and inherit the original reference strings, so the
	 * EFA-edition "Alchemist" subclass points at features whose `classSource`
	 * is still TCE. Those features are genuinely part of the 2024 subclass —
	 * exactly the "a 2024 class can carry a feature printed in an older book"
	 * case. Keeping by reference handles it, and guarantees that every
	 * reference resolves.
	 */
	const referencedClassFeatureIds = new Set(keptClasses.flatMap((entry) => entry.classFeatureIds));
	const referencedSubclassFeatureIds = new Set(keptSubclasses.flatMap((entry) => entry.subclassFeatureIds));

	const keptClassFeatures = prepared.classFeature.filter((entry) => referencedClassFeatureIds.has(entry.id));
	const keptSubclassFeatures = prepared.subclassFeature.filter((entry) => referencedSubclassFeatureIds.has(entry.id));

	// Report, then write the three files.
	const classesBySource = {};
	for (const entry of keptClasses) classesBySource[entry.source] = (classesBySource[entry.source] || 0) + 1;
	const subclassesBySource = {};
	for (const entry of keptSubclasses) subclassesBySource[entry.source] = (subclassesBySource[entry.source] || 0) + 1;

	console.log(`Classes kept:                 ${keptClasses.length}`);
	for (const source of Object.keys(classesBySource).sort()) console.log(`    ${source.padEnd(6)} ${classesBySource[source]}`);
	console.log(`Subclasses kept:              ${keptSubclasses.length}`);
	for (const source of Object.keys(subclassesBySource).sort()) console.log(`    ${source.padEnd(6)} ${subclassesBySource[source]}`);
	console.log(`Class features kept:          ${keptClassFeatures.length}`);
	console.log(`Subclass features kept:       ${keptSubclassFeatures.length}`);

	// classes.json holds classes and subclasses together, tagged so the app
	// can tell them apart.
	const combined = [
		...keptClasses.map((entry) => ({ entryType: "class", ...entry })),
		...keptSubclasses.map((entry) => ({ entryType: "subclass", ...entry })),
	];

	const classesFile = path.join(OUTPUT_DIR, "classes.json");
	const classFeaturesFile = path.join(OUTPUT_DIR, "class-features.json");
	const subclassFeaturesFile = path.join(OUTPUT_DIR, "subclass-features.json");

	console.log(`Wrote: ${classesFile} (${formatBytes(writeJson(classesFile, combined))})`);
	console.log(`Wrote: ${classFeaturesFile} (${formatBytes(writeJson(classFeaturesFile, keptClassFeatures))})`);
	console.log(`Wrote: ${subclassFeaturesFile} (${formatBytes(writeJson(subclassFeaturesFile, keptSubclassFeatures))})`);

	// A quick self-check so a broken id scheme is caught here, not later.
	const featureIds = new Set([...keptClassFeatures, ...keptSubclassFeatures].map((entry) => entry.id));
	let dangling = 0;
	for (const entry of combined) {
		for (const id of [...(entry.classFeatureIds || []), ...(entry.subclassFeatureIds || [])]) {
			if (!featureIds.has(id)) dangling++;
		}
	}
	console.log(`Dangling feature references:  ${dangling}`);

	return warnings;
}

/*
 * OPTIONAL FEATURES
 *
 * Eldritch Invocations, Metamagic, Fighting Styles, Battle Master
 * manoeuvres and so on. Which class can take one is encoded in short
 * `featureType` codes, so we attach the official plain-English wording too.
 */
function extractOptionalFeatures() {
	console.log("\n--- OPTIONAL FEATURES ---");

	const rawFeatures = readJson(path.join(SOURCE_DATA_DIR, "optionalfeatures.json")).optionalfeature;

	const { entries: resolved, copyStats, versionStats, warnings } = prepareEntries(rawFeatures, "optionalfeatures");

	console.log(`Loaded before filtering:      ${copyStats.total}`);
	console.log(`_copy blocks resolved:        ${copyStats.copiesResolved}`);
	console.log(`Entries expanded by _versions: ${versionStats.parentsExpanded} into ${versionStats.variantsCreated}`);

	const kept = resolved.filter((entry) => ALLOWED_SOURCES.includes(entry.source));

	// Translate each code using 5etools' own legend. An unknown code is
	// reported rather than guessed at.
	const unknownCodes = new Set();
	for (const entry of kept) {
		entry.featureTypeFull = (entry.featureType || []).map((code) => {
			if (OPT_FEATURE_TYPE_TO_FULL[code]) return OPT_FEATURE_TYPE_TO_FULL[code];
			unknownCodes.add(code);
			return code; // fall back to the raw code, as 5etools does
		});
	}
	if (unknownCodes.size) {
		warnings.push(`[optionalfeatures] unknown featureType code(s) not in the 5etools legend: ${[...unknownCodes].join(", ")}`);
	}

	const bySource = {};
	for (const entry of kept) bySource[entry.source] = (bySource[entry.source] || 0) + 1;
	const byType = {};
	for (const entry of kept) for (const code of entry.featureType || []) byType[code] = (byType[code] || 0) + 1;

	console.log(`Passed the source filter:     ${kept.length}`);
	for (const source of Object.keys(bySource).sort()) console.log(`    ${source.padEnd(6)} ${bySource[source]}`);
	console.log(`By featureType: ${Object.keys(byType).sort().map((code) => `${code}=${byType[code]}`).join(", ")}`);

	const outputFile = path.join(OUTPUT_DIR, "optional-features.json");
	console.log(`Wrote: ${outputFile} (${formatBytes(writeJson(outputFile, kept))})`);

	return warnings;
}

/* ============================================================================
 * SECTION 5 — MAIN
 * ==========================================================================*/

function main() {
	console.log("=".repeat(64));
	console.log("5etools data extraction");
	console.log("=".repeat(64));
	console.log(`Reading from: ${SOURCE_DATA_DIR}`);
	console.log(`Writing to:   ${OUTPUT_DIR}`);

	// Fail early and clearly if the source data is not where we expect.
	if (!fs.existsSync(SOURCE_DATA_DIR)) {
		console.error(`\nERROR: source data folder not found:\n  ${SOURCE_DATA_DIR}`);
		process.exit(1);
	}

	// Create the output folder if it does not exist yet.
	// `recursive: true` also creates any missing parent folders.
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });

	// Collect warnings from every extractor so we can show them together.
	const allWarnings = [];

	// ---- Add one line per category here as you build them out. ----
	allWarnings.push(...extractFeats());
	allWarnings.push(...extractSpells());
	allWarnings.push(...extractSpecies());
	allWarnings.push(...extractBackgrounds());
	allWarnings.push(...extractClasses());
	allWarnings.push(...extractOptionalFeatures());
	// ---------------------------------------------------------------

	console.log(`\n${"=".repeat(64)}`);
	if (allWarnings.length === 0) {
		console.log("Done. No warnings.");
	} else {
		console.log(`Done, with ${allWarnings.length} warning(s):`);
		for (const warning of allWarnings) console.log(`  ! ${warning}`);
	}
	console.log("=".repeat(64));
}

// This line actually starts everything running.
main();
