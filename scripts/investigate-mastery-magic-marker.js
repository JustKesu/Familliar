/*
 * investigate-mastery-magic-marker.js
 * ===================================
 *
 * Part 2 of the mastery-picker task: masteryWeaponsFor offers magic items that
 * happen to carry a mastery property (Sun Blade, Scimitar of Speed). Mastery is
 * chosen for a KIND of weapon at creation, so the pool must be ordinary weapons
 * only.
 *
 * Question: which items.json field cleanly separates an ordinary weapon from a
 * magic one, across the mastery-bearing items? Candidates checked: rarity,
 * reqAttune, wondrous, tier, +bonus fields, baseItem.
 *
 * Prints a SUMMARY ONLY (counts + at most 3 short examples per bucket).
 *
 * Run: node scripts/investigate-mastery-magic-marker.js
 */

const fs = require("fs");
const path = require("path");

const items = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "items.json"), "utf8"));

function tally(values) {
	const counts = new Map();
	for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
	return [...counts.entries()].sort().map(([k, n]) => `${k}=${n}`).join("  ");
}

const mastery = items.filter((i) => Array.isArray(i.masteryFull) && i.masteryFull.length > 0);
console.log(`items: ${items.length}   with a mastery property: ${mastery.length}\n`);

console.log(`rarity:           ${tally(mastery.map((i) => String(i.rarity)))}`);
console.log(`has reqAttune:     ${mastery.filter((i) => i.reqAttune !== undefined).length}`);
console.log(`wondrous===true:   ${mastery.filter((i) => i.wondrous === true).length}`);
console.log(`has tier:          ${tally(mastery.map((i) => String(i.tier)))}`);
console.log(`has bonusWeapon*:  ${mastery.filter((i) => i.bonusWeapon !== undefined || i.bonusWeaponAttack !== undefined || i.bonusWeaponDamage !== undefined).length}`);
console.log(`has baseItem:      ${mastery.filter((i) => i.baseItem !== undefined).length}`);
console.log(`weaponCategory:    ${tally(mastery.map((i) => String(i.weaponCategory)))}`);

const plain = mastery.filter((i) => i.rarity === "none");
const magic = mastery.filter((i) => i.rarity !== "none");

console.log(`\nrarity === "none"  -> ${plain.length} items`);
console.log(`  cross-check: any with reqAttune/wondrous/tier/baseItem/bonus? ` +
	plain.filter((i) => i.reqAttune !== undefined || i.wondrous === true || i.tier !== undefined || i.baseItem !== undefined || i.bonusWeapon !== undefined).length);
console.log(`  examples: ${plain.slice(0, 3).map((i) => `${i.name} (${i.source}, ${i.weaponCategory})`).join(" | ")}`);
console.log(`  ...names: ${plain.map((i) => i.name).sort().join(", ")}`);

console.log(`\nrarity !== "none"  -> ${magic.length} items`);
console.log(`  rarities: ${tally(magic.map((i) => String(i.rarity)))}`);
console.log(`  examples: ${magic.slice(0, 3).map((i) => `${i.name} (${i.rarity}, attune=${i.reqAttune !== undefined})`).join(" | ")}`);

// Would any class actually be offered a magic mastery item today? (the pool is
// already narrowed to weapons the class is proficient with, but rarity is not
// consulted). Show the magic ones that are plain martial/simple weapons.
const magicButOrdinaryCategory = magic.filter((i) => i.weaponCategory === "martial" || i.weaponCategory === "simple");
console.log(`\nmagic items with a simple/martial weaponCategory (these are what leak into the picker): ${magicButOrdinaryCategory.length}`);
console.log(`  ${magicButOrdinaryCategory.slice(0, 3).map((i) => `${i.name} (${i.rarity})`).join(" | ")}`);
