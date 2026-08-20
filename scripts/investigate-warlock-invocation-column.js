const fs = require("fs");
const path = require("path");
const classes = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "classes.json"), "utf8"));
const sorcerer = classes.find((c) => c.entryType === "class" && c.name === "Sorcerer" && c.source === "XPHB");
console.log("Sorcerer optionalfeatureProgression raw:", JSON.stringify(sorcerer.optionalfeatureProgression));
console.log("Is Sorcerer's .progression an array?", Array.isArray(sorcerer.optionalfeatureProgression[0].progression));
console.log("");
const warlock = classes.find((c) => c.entryType === "class" && c.name === "Warlock" && c.source === "XPHB");
const groups = warlock.classTableGroups || [];
for (const g of groups) {
	const labels = g.colLabels || [];
	const idx = labels.findIndex((l) => /invocation|known/i.test(String(l)));
	if (idx !== -1) {
		console.log("title:", g.title, "colLabels:", JSON.stringify(labels));
		console.log("rows.length:", g.rows.length);
		console.log("all rows, col", idx, ":", g.rows.map((r) => r[idx]));
		console.log("raw optionalfeatureProgression:", JSON.stringify(warlock.optionalfeatureProgression));
		console.log("rowsSpellProgression present?", !!g.rowsSpellProgression);
	}
}
