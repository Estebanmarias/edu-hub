const d = require("../" + process.argv[2]);
console.log(d.subjectTitle, "| lessons:", d.lessons.length, "| restricted:", d.lessons.filter((l) => l.restricted === true).length);
const by = {};
for (const l of d.lessons) { const k = l.keyStageSlug + " | " + l.subjectSlug; by[k] = (by[k] || 0) + 1; }
console.log(by);
const titles = [...new Set(d.lessons.map((l) => l.keyStageSlug + ": " + l.unitTitle))];
console.log(titles.length, "units. First 60:");
console.log(titles.slice(0, 60).join("\n"));
