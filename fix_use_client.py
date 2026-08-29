from pathlib import Path
NL = chr(10)

files = [
    "src/components/CatchesTab.tsx",
    "src/components/SocialTab.tsx",
    "src/components/ai/SpotSuggester.tsx",
]

imp = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"

for fp in files:
    p = Path(fp)
    t = p.read_text()
    if t.startswith(imp):
        rest = t[len(imp):].lstrip(NL)
        if rest.startswith("'use client';"):
            after_directive = rest[len("'use client';"):].lstrip(NL)
            new_t = "'use client';" + NL + imp + NL + after_directive
            p.write_text(new_t)
            print(fp + ": fixed")
        else:
            print(fp + ": unexpected structure, skipped")
    else:
        print(fp + ": import not at top, skipped")
