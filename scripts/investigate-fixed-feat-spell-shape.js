/*
 * investigate-fixed-feat-spell-shape.js
 * ========================================
 *
 * Step 6 slice d5a needs the exact field shape for the two feats already
 * identified (investigate-feat-spells.js, investigate-feat-spell-ability.js)
 * as fully fixed: Drow High Magic (spells fixed, ability fixed CHA) and Fey
 * Teleportation (spells fixed, ability fixed INT). This script re-reads only
 * those two feats' additionalSpells entries, trimmed, to confirm before
 * writing the derived-lookup function.
 *
 * Run: node scripts/investigate-fixed-feat-spell-shape.js
 */

const fs = require("fs");
const path = require("path");

const feats = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "feats.json"), "utf8"));

console.log("SUMMARY");
for (const targetName of ["Drow High Magic", "Fey Teleportation"]) {
	const feat = feats.find((f) => f.name === targetName);
	if (!feat) {
		console.log(targetName, ": NOT FOUND");
		continue;
	}
	console.log("\n---", feat.name, "(" + feat.source + ") ---");
	console.log("additionalSpells:", JSON.stringify(feat.additionalSpells));
}
