"""Rewrite .env.local using PostgREST host keys."""

import os
import tempfile

d = {}
with open(".env.local") as handle:
    for line in handle:
        line = line.strip()
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        d[k.strip()] = v.strip()
g = d.get
out = [
    "NEXT_PUBLIC_SUPABASE_URL=" + g("POSTFRE_HOST_SUPABASE_URL", ""),
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=" + g("POSTFRE_HOST_SUPABASE_ANON_KEY", ""),
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="
    + g("NEXT_PUBLIC_POSTFRE_HOST_SUPABASE_PUBLISHABLE_KEY", ""),
    "SUPABASE_SERVICE_ROLE_KEY=" + g("POSTFRE_HOST_SUPABASE_SERVICE_ROLE_KEY", ""),
    "OLLAMA_BASE_URL=http://localhost:11434/v1",
    "OLLAMA_MODEL=llama3.1",
    "OLLAMA_VISION_MODEL=llama3.2-vision",
]
directory = os.path.dirname(os.path.abspath(".env.local")) or "."
fd, temp_path = tempfile.mkstemp(dir=directory, prefix=".env.local.", text=True)
try:
    with os.fdopen(fd, "w") as handle:
        handle.write(chr(10).join(out) + chr(10))
    os.replace(temp_path, ".env.local")
except Exception:
    try:
        os.unlink(temp_path)
    except FileNotFoundError:
        pass
    raise
print("rewritten")
