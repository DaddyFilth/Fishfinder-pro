import re
from pathlib import Path

NL = chr(10)

species = [
    "Largemouth Bass","Smallmouth Bass","Spotted Bass",
    "Channel Catfish","Blue Catfish","Flathead Catfish",
    "Walleye","Rainbow Trout","Brown Trout",
    "Crappie","Black Crappie","White Crappie",
    "Bluegill","Redear Sunfish","Striped Bass",
    "White Bass","Hybrid Striper","Redfish/Red Drum",
    "Flounder","Sauger","Common Carp","Northern Pike"
]

def slug(s):
    return s.lower().replace(" ", "-").replace("/", "-")

lines = []
for sp in species:
    slugged = slug(sp)
    line = "  '" + sp + "': '/species/" + slugged + ".jpg'"
    lines.append(line)

body = ("," + NL).join(lines)
header = "export const SPECIES_IMAGES: Record<string, string> = {" + NL
footer = NL + "};"
new_map = header + body + "," + footer

sa_path = Path("src/lib/scoring/speciesAdvisor.ts")
text = sa_path.read_text()
pattern = "export const SPECIES_IMAGES: Record<string, string> = \\{.*?\
\\};"
text = re.sub(pattern, new_map, text, flags=re.DOTALL)
sa_path.write_text(text)
print("SPECIES_IMAGES map updated to local paths")
