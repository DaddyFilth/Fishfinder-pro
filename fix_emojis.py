"""Replace emoji-based fish imagery with species image assets."""

import re
from pathlib import Path
NL = chr(10)

sa = Path("src/lib/scoring/speciesAdvisor.ts")
TEXT_CONTENT = sa.read_text()

ALIAS_LINES = [
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
ALIAS_BLOCK = NL.join(ALIAS_LINES) + NL

old_fn_lines = [
    "export function getSpeciesImage(speciesName: string): string {",
    "  return SPECIES_IMAGES[speciesName]",
    "    ?? 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Largemouth_bass.png/320px-Largemouth_bass.png';",
    "}",
]
old_fn = NL.join(old_fn_lines)

new_fn_lines = [
    "export function getSpeciesImage(speciesName: string): string {",
    "  const resolved = SPECIES_ALIASES[speciesName] || speciesName;",
    "  return SPECIES_IMAGES[resolved] ?? SPECIES_IMAGES['Largemouth Bass'];",
    "}",
]
new_fn = NL.join(new_fn_lines)

if old_fn in TEXT_CONTENT:
    TEXT_CONTENT = TEXT_CONTENT.replace(old_fn, ALIAS_BLOCK + new_fn)
else:
    pat = "export function getSpeciesImage.*?" + NL + "\\}"
    TEXT_CONTENT = re.sub(pat, ALIAS_BLOCK + new_fn, TEXT_CONTENT, flags=re.DOTALL)

sa.write_text(TEXT_CONTENT)
print("speciesAdvisor.ts: aliases added")

ct = Path("src/components/CatchesTab.tsx")
TEXT_CONTENT = ct.read_text()
TEXT_CONTENT = TEXT_CONTENT.replace(", emoji:'\U0001F41F' },", " },")
TEXT_CONTENT = TEXT_CONTENT.replace(", emoji:'\U0001F988' },", " },")
TEXT_CONTENT = TEXT_CONTENT.replace(", emoji:'\U0001F420' },", " },")
TEXT_CONTENT = re.sub(
    r", emoji:EMOJI_MAP\[form\.species\]\|\|'\U0001F41F'", "", TEXT_CONTENT
)
TEXT_CONTENT = re.sub(
    r"const EMOJI_MAP:Record<string,string> = \{[^}]*\};" + NL + "?",
    "",
    TEXT_CONTENT,
)
TEXT_CONTENT = TEXT_CONTENT.replace("emoji:string; }", "}")
old_div = "<div style={{fontSize:'32px'}}>{c.emoji}</div>"
new_img = (
    "<img src={getSpeciesImage(c.species)} alt={c.species} "
    "style={{width:'40px',height:'40px',objectFit:'cover',"
    "borderRadius:'8px'}} />"
)
TEXT_CONTENT = TEXT_CONTENT.replace(old_div, new_img)
if "getSpeciesImage" in TEXT_CONTENT and "import { getSpeciesImage }" not in TEXT_CONTENT:
    imp = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    TEXT_CONTENT = imp + NL + TEXT_CONTENT
ct.write_text(TEXT_CONTENT)
print("CatchesTab.tsx: updated")

st = Path("src/components/SocialTab.tsx")
TEXT_CONTENT = st.read_text()
TEXT_CONTENT = re.sub(r",emoji:'[^']*'", "", TEXT_CONTENT)
old_div2 = "<div style={{fontSize:'28px'}}>{post.emoji}</div>"
new_img2 = (
    "<img src={getSpeciesImage(post.species)} alt={post.species} "
    "style={{width:'36px',height:'36px',objectFit:'cover',"
    "borderRadius:'8px'}} />"
)
TEXT_CONTENT = TEXT_CONTENT.replace(old_div2, new_img2)
if "getSpeciesImage" in TEXT_CONTENT and "import { getSpeciesImage }" not in TEXT_CONTENT:
    imp = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    TEXT_CONTENT = imp + NL + TEXT_CONTENT
st.write_text(TEXT_CONTENT)
print("SocialTab.tsx: updated")

sp = Path("src/components/ai/SpotSuggester.tsx")
TEXT_CONTENT = sp.read_text()
old_chip = (
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
TEXT_CONTENT = TEXT_CONTENT.replace(old_chip, new_chip)
if "getSpeciesImage" in TEXT_CONTENT and "import { getSpeciesImage }" not in TEXT_CONTENT:
    imp = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    TEXT_CONTENT = imp + NL + TEXT_CONTENT
sp.write_text(TEXT_CONTENT)
print("SpotSuggester.tsx: updated")

fm = Path("src/components/ai/FishIdentifierModal.tsx")
TEXT_CONTENT = fm.read_text()
TEXT_CONTENT = TEXT_CONTENT.replace("\U0001F41F AI Fish Species Scanner", "AI Fish Species Scanner")
fm.write_text(TEXT_CONTENT)
print("FishIdentifierModal.tsx: updated")
