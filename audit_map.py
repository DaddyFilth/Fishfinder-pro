from pathlib import Path
import re

print("=== page.tsx tab/route map ===")
p = Path("src/app/page.tsx")
if p.exists():
    t = p.read_text()
    imports = re.findall(r"import\s+\{?\s*(\w+)\s*\}?\s+from\s+'([^']+)'", t)
    for name, src in imports:
        if "components" in src or "app" in src:
            print(name, "<-", src)
else:
    print("page.tsx not found at src/app/page.tsx")

print()
print("=== API routes ===")
api_dir = Path("src/app/api")
if api_dir.exists():
    for f in api_dir.rglob("route.ts"):
        print(f)
else:
    print("no src/app/api directory")

print()
print("=== components missing loading/error/empty handling (heuristic) ===")
comp_dir = Path("src/components")
for f in comp_dir.rglob("*.tsx"):
    t = f.read_text()
    uses_fetch = "fetch(" in t or "useEffect" in t
    has_loading = "loading" in t.lower()
    has_error = "error" in t.lower()
    has_empty = "length === 0" in t or "length===0" in t or ".length ?" in t
    if uses_fetch and not (has_loading and has_error):
        print(str(f) + " -> loading:" + str(has_loading) + " error:" + str(has_error) + " empty:" + str(has_empty))
