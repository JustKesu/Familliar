const fs = require("fs");
const path = require("path");
const DATA_DIR = path.join(__dirname, "..", "data");
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8")); }

const classes = readJson("classes.json");
const withProg = classes.filter((e) => e.entryType === "subclass" && e.optionalfeatureProgression);
console.log(`Subclasses with optionalfeatureProgression: ${withProg.length}`);
for (const sc of withProg) {
  console.log(JSON.stringify({
    name: sc.name, shortName: sc.shortName, source: sc.source,
    className: sc.className, classSource: sc.classSource,
    optionalfeatureProgression: sc.optionalfeatureProgression,
  }, null, 0));
}

console.log("\n-- sample optional-features.json entries --");
const opt = readJson("optional-features.json");
console.log(`total: ${opt.length}`);
const maneuvers = opt.filter(f => (f.featureType||[]).includes("MV")).slice(0,2);
console.log(JSON.stringify(maneuvers, null, 2).slice(0, 1500));
console.log("\nfeatureType values present:", [...new Set(opt.flatMap(f => f.featureType||[]))]);
