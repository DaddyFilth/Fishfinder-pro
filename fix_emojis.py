import re
from pathlib import Path
NL = chr(10)

sa = Path("src/lib/scoring/speciesAdvisor.ts")
TEXT = sa.read_text()

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
ALIAS_BLOCK = NL.join(alias_lines) + NL

OLD_FN_LINES = [
    "export function getSpeciesImage(speciesName: string): string {",
    "  return SPECIES_IMAGES[speciesName]",
    "    ?? 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/"
    "Largemouth_bass.png/320px-Largemouth_bass.png';",
    "}",
]
OLD_FN = NL.join(OLD_FN_LINES)

NEW_FN_LINES = [
    "export function getSpeciesImage(speciesName: string): string {",
    "  const resolved = SPECIES_ALIASES[speciesName] || speciesName;",
    "  return SPECIES_IMAGES[resolved] ?? SPECIES_IMAGES['Largemouth Bass'];",
    "}",
]
NEW_FN = NL.join(NEW_FN_LINES)

if OLD_FN in TEXT:
    TEXT = TEXT.replace(OLD_FN, ALIAS_BLOCK + NEW_FN)
else:
    pat = "export function getSpeciesImage.*?" + NL + "\\}"
    TEXT = re.sub(pat, ALIAS_BLOCK + NEW_FN, TEXT, flags=re.DOTALL)

sa.write_text(TEXT)
print("speciesAdvisor.ts: aliases added")

ct = Path("src/components/CatchesTab.tsx")
TEXT = ct.read_text()
TEXT = TEXT.replace(", emoji:'\U0001F41F' },", " },")
TEXT = TEXT.replace(", emoji:'\U0001F988' },", " },")
TEXT = TEXT.replace(", emoji:'\U0001F420' },", " },")
TEXT = re.sub(r", emoji:EMOJI_MAP\[form\.species\]\|\|'\U0001F41F'", "", TEXT)
TEXT = re.sub(r"const EMOJI_MAP:Record<string,string> = \{[^}]*\};" + NL + "?", "", TEXT)
TEXT = TEXT.replace("emoji:string; }", "}")
old_div = "<div style={{fontSize:'32px'}}>{c.emoji}</div>"
NEW_IMG = (
    "<img src={getSpeciesImage(c.species)} alt={c.species} "
    "style={{width:'40px',height:'40px',objectFit:'cover',"
    "borderRadius:'8px'}} />"
)
TEXT = TEXT.replace(old_div, NEW_IMG)
if "getSpeciesImage" in TEXT and "import { getSpeciesImage }" not in TEXT:
    IMP = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    TEXT = IMP + NL + TEXT
ct.write_text(TEXT)
print("CatchesTab.tsx: updated")

st = Path("src/components/SocialTab.tsx")
TEXT = st.read_text()
TEXT = re.sub(r",emoji:'[^']*'", "", TEXT)
old_div2 = "<div style={{fontSize:'28px'}}>{post.emoji}</div>"
NEW_IMG2 = (
    "<img src={getSpeciesImage(post.species)} alt={post.species} "
    "style={{width:'36px',height:'36px',objectFit:'cover',"
    "borderRadius:'8px'}} />"
)
TEXT = TEXT.replace(old_div2, NEW_IMG2)
if "getSpeciesImage" in TEXT and "import { getSpeciesImage }" not in TEXT:
    IMP = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    TEXT = IMP + NL + TEXT
st.write_text(TEXT)
print("SocialTab.tsx: updated")

sp = Path("src/components/ai/SpotSuggester.tsx")
TEXT = sp.read_text()
old_chip = (
    "<span key={j} style={{ background:'#0f3460',"
    "color:'#93c5fd',fontSize:'9px',padding:'2px 7px',"
    "borderRadius:'10px' }}>\U0001F41F {sp}</span>"
)
NEW_CHIP = (
    "<span key={j} style={{ background:'#0f3460',"
    "color:'#93c5fd',fontSize:'9px',padding:'2px 7px',"
    "borderRadius:'10px',display:'inline-flex',"
    "alignItems:'center',gap:'4px' }}>"
    "<img src={getSpeciesImage(sp)} alt={sp} "
    "style={{width:'14px',height:'14px',objectFit:'cover',"
    "borderRadius:'50%'}} /> {sp}</span>"
)
TEXT = TEXT.replace(old_chip, NEW_CHIP)
if "getSpeciesImage" in TEXT and "import { getSpeciesImage }" not in TEXT:
    IMP = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    TEXT = IMP + NL + TEXT
sp.write_text(TEXT)
print("SpotSuggester.tsx: updated")

fm = Path("src/components/ai/FishIdentifierModal.tsx")
TEXT = fm.read_text()
TEXT = TEXT.replace("\U0001F41F AI Fish Species Scanner", "AI Fish Species Scanner")
fm.write_text(TEXT)
print("FishIdentifierModal.tsx: updated")
