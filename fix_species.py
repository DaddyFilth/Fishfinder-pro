"""Update the species image map in the advisor source."""

import re
from pathlib import Path

NL = chr(10)

SPECIES = [
    "Largemouth Bass", "Smallmouth Bass", "Spotted Bass",
    "Channel Catfish", "Blue Catfish", "Flathead Catfish",
    "Walleye", "Rainbow Trout", "Brown Trout",
    "Crappie", "Black Crappie", "White Crappie",
    "Bluegill", "Redear Sunfish", "Striped Bass",
    "White Bass", "Hybrid Striper", "Redfish/Red Drum",
    "Flounder", "Sauger", "Common Carp", "Northern Pike"
]

def slug(species_name):
    """Convert a species name into a URL slug."""
    return species_name.lower().replace(" ", "-").replace("/", "-")

LINES = []
for sp in SPECIES:
    SLUGGED = slug(sp)
    LINE = "  '" + sp + "': '/species/" + SLUGGED + ".jpg'"
    LINES.append(LINE)

BODY = ("," + NL).join(LINES)
HEADER = "export const SPECIES_IMAGES: Record<string, string> = {" + NL
FOOTER = NL + "};"
NEW_MAP = HEADER + BODY + "," + FOOTER

SA_PATH = Path("src/lib/scoring/speciesAdvisor.ts")
TEXT = SA_PATH.read_text()
PATTERN = "export const SPECIES_IMAGES: Record<string, string> = \\{.*?\
\\};"
TEXT = re.sub(PATTERN, NEW_MAP, TEXT, flags=re.DOTALL)
SA_PATH.write_text(TEXT)
print("SPECIES_IMAGES map updated to local paths")
