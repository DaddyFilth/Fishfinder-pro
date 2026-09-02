"""Update fish imagery and remove emoji-based species markers from the UI."""

import re
from pathlib import Path
NL = chr(10)

SPECIES_ADVISOR_PATH = Path("src/lib/scoring/speciesAdvisor.ts")
TEXT = SPECIES_ADVISOR_PATH.read_text()

alias_lines = [
    "const SPECIES_ALIASES: Record<string, string> = {",
    "  'Redfish': 'Redfish/Red Drum',",
    "  'Red Drum': 'Redfish/Red Drum',",
    "  'Trout': 'Rainbow Trout',",
    "  'Speckled Trout': 'Rainbow Trout',",
    "  'Carp': 'Common Carp',",
    "  'Pike': 'Northern Pike',",
    "};",
    "",
]
alias_block = NL.join(alias_lines) + NL

old_fn_lines = [
    "export function getSpeciesImage(speciesName: string): string {",
    "  return SPECIES_IMAGES[speciesName]",
    "    ?? 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Largemouth_bass.png/320px-Largemouth_bass.png';",
    "}",
]
OLD_FN = NL.join(old_fn_lines)

new_fn_lines = [
    "export function getSpeciesImage(speciesName: string): string {",
    "  const resolved = SPECIES_ALIASES[speciesName] || speciesName;",
    "  return SPECIES_IMAGES[resolved] ?? SPECIES_IMAGES['Largemouth Bass'];",
    "}",
]
NEW_FN = NL.join(new_fn_lines)

if OLD_FN in TEXT:
    TEXT = TEXT.replace(OLD_FN, alias_block + NEW_FN)
else:
    PATTERN = "export function getSpeciesImage.*?" + NL + "\\}"
    TEXT = re.sub(PATTERN, alias_block + NEW_FN, TEXT, flags=re.DOTALL)

SPECIES_ADVISOR_PATH.write_text(TEXT)
print("speciesAdvisor.ts: aliases added")

CATCHES_TAB_PATH = Path("src/components/CatchesTab.tsx")
TEXT = CATCHES_TAB_PATH.read_text()
TEXT = TEXT.replace(", emoji:'\U0001F41F' },", " },")
TEXT = TEXT.replace(", emoji:'\U0001F988' },", " },")
TEXT = TEXT.replace(", emoji:'\U0001F420' },", " },")
TEXT = re.sub(r", emoji:EMOJI_MAP\[form\.species\]\|\|'\U0001F41F'", "", TEXT)
TEXT = re.sub(r"const EMOJI_MAP:Record<string,string> = \{[^}]*\};" + NL + "?", "", TEXT)
TEXT = TEXT.replace("emoji:string; }", "}")
OLD_DIV = "<div style={{fontSize:'32px'}}>{c.emoji}</div>"
new_img = (
    "<img src={getSpeciesImage(c.species)} alt={c.species} "
    "style={{width:'40px',height:'40px',objectFit:'cover',"
    "borderRadius:'8px'}} />"
)
TEXT = TEXT.replace(OLD_DIV, new_img)
if "getSpeciesImage" in TEXT and "import { getSpeciesImage }" not in TEXT:
    imp = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    TEXT = imp + NL + TEXT
CATCHES_TAB_PATH.write_text(TEXT)
print("CatchesTab.tsx: updated")

SOCIAL_TAB_PATH = Path("src/components/SocialTab.tsx")
TEXT = SOCIAL_TAB_PATH.read_text()
TEXT = re.sub(r",emoji:'[^']*'", "", TEXT)
OLD_DIV2 = "<div style={{fontSize:'28px'}}>{post.emoji}</div>"
new_img2 = (
    "<img src={getSpeciesImage(post.species)} alt={post.species} "
    "style={{width:'36px',height:'36px',objectFit:'cover',"
    "borderRadius:'8px'}} />"
)
TEXT = TEXT.replace(OLD_DIV2, new_img2)
if "getSpeciesImage" in TEXT and "import { getSpeciesImage }" not in TEXT:
    imp = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    TEXT = imp + NL + TEXT
SOCIAL_TAB_PATH.write_text(TEXT)
print("SocialTab.tsx: updated")

SPOT_SUGGESTER_PATH = Path("src/components/ai/SpotSuggester.tsx")
TEXT = SPOT_SUGGESTER_PATH.read_text()
OLD_CHIP = (
    "<span key={j} style={{ background:'#0f3460',"
    "color:'#93c5fd',fontSize:'9px',padding:'2px 7px',"
    "borderRadius:'10px' }}>\U0001F41F {sp}</span>"
)
new_chip = (
    "<span key={j} style={{ background:'#0f3460',"
    "color:'#93c5fd',fontSize:'9px',padding:'2px 7px',"
    "borderRadius:'10px',display:'inline-flex',"
    "alignItems:'center',gap:'4px' }}>"
    "<img src={getSpeciesImage(sp)} alt={sp} "
    "style={{width:'14px',height:'14px',objectFit:'cover',"
    "borderRadius:'50%'}} /> {sp}</span>"
)
TEXT = TEXT.replace(OLD_CHIP, new_chip)
if "getSpeciesImage" in TEXT and "import { getSpeciesImage }" not in TEXT:
    imp = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    TEXT = imp + NL + TEXT
SPOT_SUGGESTER_PATH.write_text(TEXT)
print("SpotSuggester.tsx: updated")

FISH_IDENTIFIER_MODAL_PATH = Path("src/components/ai/FishIdentifierModal.tsx")
TEXT = FISH_IDENTIFIER_MODAL_PATH.read_text()
TEXT = TEXT.replace("\U0001F41F AI Fish Species Scanner", "AI Fish Species Scanner")
FISH_IDENTIFIER_MODAL_PATH.write_text(TEXT)
print("FishIdentifierModal.tsx: updated")
