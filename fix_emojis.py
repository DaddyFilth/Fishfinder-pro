import re
from pathlib import Path
NL = chr(10)

sa = Path("src/lib/scoring/speciesAdvisor.ts")
t = sa.read_text()

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
old_fn = NL.join(old_fn_lines)

new_fn_lines = [
    "export function getSpeciesImage(speciesName: string): string {",
    "  const resolved = SPECIES_ALIASES[speciesName] || speciesName;",
    "  return SPECIES_IMAGES[resolved] ?? SPECIES_IMAGES['Largemouth Bass'];",
    "}",
]
new_fn = NL.join(new_fn_lines)

if old_fn in t:
    t = t.replace(old_fn, alias_block + new_fn)
else:
    pat = "export function getSpeciesImage.*?" + NL + "\\}"
    t = re.sub(pat, alias_block + new_fn, t, flags=re.DOTALL)

sa.write_text(t)
print("speciesAdvisor.ts: aliases added")

ct = Path("src/components/CatchesTab.tsx")
t = ct.read_text()
t = t.replace(", emoji:'\U0001F41F' },", " },")
t = t.replace(", emoji:'\U0001F988' },", " },")
t = t.replace(", emoji:'\U0001F420' },", " },")
t = re.sub(r", emoji:EMOJI_MAP\[form\.species\]\|\|'\U0001F41F'", "", t)
t = re.sub(r"const EMOJI_MAP:Record<string,string> = \{[^}]*\};" + NL + "?", "", t)
t = t.replace("emoji:string; }", "}")
old_div = "<div style={{fontSize:'32px'}}>{c.emoji}</div>"
new_img = (
    "<img src={getSpeciesImage(c.species)} alt={c.species} "
    "style={{width:'40px',height:'40px',objectFit:'cover',"
    "borderRadius:'8px'}} />"
)
t = t.replace(old_div, new_img)
if "getSpeciesImage" in t and "import { getSpeciesImage }" not in t:
    imp = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    t = imp + NL + t
ct.write_text(t)
print("CatchesTab.tsx: updated")

st = Path("src/components/SocialTab.tsx")
t = st.read_text()
t = re.sub(r",emoji:'[^']*'", "", t)
old_div2 = "<div style={{fontSize:'28px'}}>{post.emoji}</div>"
new_img2 = (
    "<img src={getSpeciesImage(post.species)} alt={post.species} "
    "style={{width:'36px',height:'36px',objectFit:'cover',"
    "borderRadius:'8px'}} />"
)
t = t.replace(old_div2, new_img2)
if "getSpeciesImage" in t and "import { getSpeciesImage }" not in t:
    imp = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    t = imp + NL + t
st.write_text(t)
print("SocialTab.tsx: updated")

sp = Path("src/components/ai/SpotSuggester.tsx")
t = sp.read_text()
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
t = t.replace(old_chip, new_chip)
if "getSpeciesImage" in t and "import { getSpeciesImage }" not in t:
    imp = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"
    t = imp + NL + t
sp.write_text(t)
print("SpotSuggester.tsx: updated")

fm = Path("src/components/ai/FishIdentifierModal.tsx")
t = fm.read_text()
t = t.replace("\U0001F41F AI Fish Species Scanner", "AI Fish Species Scanner")
fm.write_text(t)
print("FishIdentifierModal.tsx: updated")
