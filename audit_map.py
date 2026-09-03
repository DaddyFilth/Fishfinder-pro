"""Print a quick map of the application's routes and component imports."""

from pathlib import Path
import re

print("=== page.tsx tab/route map ===")
P = Path("src/app/page.tsx")
if P.exists():
    T = P.read_text()
    IMPORTS = re.findall(r"import\s+\{?\s*(\w+)\s*\}?\s+from\s+'([^']+)'", T)
    for name, src in IMPORTS:
        if "components" in src or "app" in src:
            print(name, "<-", src)
else:
    print("page.tsx not found at src/app/page.tsx")

print()
print("=== API routes ===")
API_DIR = Path("src/app/api")
if API_DIR.exists():
    for f in API_DIR.rglob("route.ts"):
        print(f)
else:
    print("no src/app/api directory")

print()
print("=== components missing loading/error/empty handling (heuristic) ===")
COMP_DIR = Path("src/components")
for f in COMP_DIR.rglob("*.tsx"):
    T = f.read_text()
    uses_fetch = "fetch(" in T or "useEffect" in T
    has_loading = "loading" in T.lower()
    has_error = "error" in T.lower()
    has_empty = "length === 0" in T or "length===0" in T or ".length ?" in T
    if uses_fetch and not (has_loading and has_error):
        print(
            str(f)
            + " -> loading:"
            + str(has_loading)
            + " error:"
            + str(has_error)
            + " empty:"
            + str(has_empty)
        )
