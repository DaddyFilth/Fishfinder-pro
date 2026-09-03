"""Ensure client directives precede imports in client components."""

from pathlib import Path
NL = chr(10)

FILES = [
    "src/components/CatchesTab.tsx",
    "src/components/SocialTab.tsx",
    "src/components/ai/SpotSuggester.tsx",
]

IMP = "import { getSpeciesImage } from '@/lib/scoring/speciesAdvisor';"

for fp in FILES:
    p = Path(fp)
    t = p.read_text()
    if t.startswith(IMP):
        rest = t[len(IMP):].lstrip(NL)
        if rest.startswith("'use client';"):
            after_directive = rest[len("'use client';"):].lstrip(NL)
            new_t = "'use client';" + NL + IMP + NL + after_directive
            p.write_text(new_t)
            print(fp + ": fixed")
        else:
            print(fp + ": unexpected structure, skipped")
    else:
        print(fp + ": import not at top, skipped")
