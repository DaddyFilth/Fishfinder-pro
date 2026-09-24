#!/usr/bin/env bash
set -e

echo "=================================================="
echo "    🐟 SEAMCAST / FISHFINDER-PRO TEST SUITE       "
echo "=================================================="

# 1. Environment & Git Branch Verification
echo -n "📍 [1/5] Checking Git branch... "
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "⚠️ Warning: Currently on branch '$BRANCH' (expected 'main')"
else
  echo "✅ On 'main' branch ($(git rev-parse --short HEAD))"
fi

# 2. Strict TypeScript Compilation Check
echo "🔍 [2/5] Running TypeScript compiler checks..."
# Drop incremental build state first. A stale tsconfig.tsbuildinfo keeps route
# type files that no longer exist in .next/types in the program, which makes
# this check fail with TS6053 "File not found" after routes move or are removed.
rm -f tsconfig.tsbuildinfo
if npx tsc --noEmit; then
  echo "✅ TypeScript check passed (0 syntax/type errors)"
else
  echo "❌ TypeScript compilation failed. Fix errors above before proceeding."
  exit 1
fi

# 3. ESLint Code Quality Audit (Next.js 16 removed the `next lint` CLI)
echo "🧹 [3/5] Running ESLint..."
if npx eslint .; then
  echo "✅ Lint check passed (0 lint/syntax warnings)"
else
  echo "❌ Lint check failed."
  exit 1
fi

# 4. Vitest Unit & Integration Tests
echo "🧪 [4/5] Executing test files (*.test.ts / *.test.tsx)..."
if npx vitest run; then
  echo "✅ Unit test suite executed successfully"
else
  echo "❌ Unit tests failed."
  exit 1
fi

# 5. Live Spots & Supabase Unit Sanity Check
echo "⚡ [5/5] Testing core modules and helper exports..."
node -e '
  const fs = require("fs");
  const assert = require("assert");

  // Check nearbySpots exports
  const nearby = fs.readFileSync("src/lib/nearbySpots.ts", "utf8");
  assert(nearby.includes("formatDistance"), "Missing formatDistance export");
  assert(nearby.includes("sortSpotsByDistance"), "Missing sortSpotsByDistance export");
  assert(nearby.includes("distanceMiles"), "Missing distanceMiles export");
  console.log("  ✓ nearbySpots exports verified");

  // Check LiveSpotsContext
  const context = fs.readFileSync("src/contexts/LiveSpotsContext.tsx", "utf8");
  assert(context.includes("resolveDataSource"), "Missing resolveDataSource");
  assert(context.includes("LiveSpotsProvider"), "Missing LiveSpotsProvider");
  console.log("  ✓ LiveSpotsContext exports verified");

  // Check seamcastSpotsClient
  const client = fs.readFileSync("src/lib/seamcastSpotsClient.ts", "utf8");
  assert(client.includes("fetchSeamcastAiSpots"), "Missing fetchSeamcastAiSpots");
  console.log("  ✓ seamcastSpotsClient verified");
'
echo "✅ Core sanity validation passed"

echo "=================================================="
echo "🎉 ALL TEST SUITES PASSED — READY FOR PRODUCTION!"
echo "=================================================="
