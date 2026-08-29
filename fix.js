const fs = require("fs");
let src = fs.readFileSync("src/components/FishingMap.tsx", "utf8");
src = src.replace("}));\
\
  const rankedSpots", "})), [spots, conditions]);\
\
  const rankedSpots");
fs.writeFileSync("src/components/FishingMap.tsx", src);
console.log("Done. Remaining:", (src.match(/}\)\);/) || []).length);
