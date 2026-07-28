const fs = require("fs");
const path = require("path");
const opt = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "optional-features.json"), "utf8"));
for (const code of ["MV:B", "AS", "RN"]) {
	const matches = opt.filter((f) => (f.featureType || []).includes(code));
	console.log(code, matches.length);
	const sample = matches[0];
	console.log(
		JSON.stringify(
			{ name: sample.name, source: sample.source, featureType: sample.featureType, entries: sample.entries },
			null,
			2,
		).slice(0, 600),
	);
}
