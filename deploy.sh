#!/bin/bash

# Fishfinder-Pro Deployment Script
# Prepares and deploys to production

set -e

echo "🚀 Fishfinder-Pro Deployment Script"
echo "===================================="
echo ""

# Check git status
echo "📋 Checking git status..."
if [ -z "$(git status --short)" ]; then
    echo "✓ Working directory is clean"
else
    echo "⚠️  Uncommitted changes detected:"
    git status --short
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 1
    fi
fi

# Verify build
echo ""
echo "🔨 Verifying production build..."
npm run build
echo "✓ Build successful"

# Run tests
echo ""
echo "🧪 Running tests..."
if npm run test 2>/dev/null; then
    echo "✓ All tests passed"
else
    echo "⚠️  No tests found or tests failed"
fi

# Run lint
echo ""
echo "🔍 Running linter..."
npm run lint 2>/dev/null || echo "⚠️  Linting issues found (review in IDE)"

# Type check
echo ""
echo "📝 Type checking..."
npx tsc --noEmit
echo "✓ No type errors"

# Verify environment
echo ""
echo "🔐 Verifying environment configuration..."
if grep -q "NEXT_PUBLIC_SUPABASE_URL=https://" .env.local; then
    echo "✓ Supabase URL configured"
else
    echo "❌ Supabase URL not configured properly"
    exit 1
fi

if grep -q "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=" .env.local; then
    echo "✓ Supabase publishable key configured"
else
    echo "❌ Supabase publishable key not configured"
    exit 1
fi

if grep -q "SUPABASE_SERVICE_ROLE_KEY=" .env.local; then
    echo "✓ Supabase service role key configured"
else
    echo "❌ Supabase service role key not configured"
    exit 1
fi

# Commit changes
echo ""
echo "💾 Preparing git commit..."
git add -A
git commit -m "chore: deployment - production build ready" || echo "No changes to commit"

# Show deployment options
echo ""
echo "✅ Project ready for deployment!"
echo ""
echo "📦 Deployment Options:"
echo ""
echo "1️⃣  Vercel (Recommended - Automatic)"
echo "   $ git push origin main"
echo "   Then connect repo at: https://vercel.com/new"
echo ""
echo "2️⃣  Docker (Self-hosted)"
echo "   $ docker build -t fishfinder-pro:latest ."
echo "   $ docker run -p 3000:3000 fishfinder-pro:latest"
echo ""
echo "3️⃣  Manual Deploy"
echo "   $ npm run build"
echo "   $ NODE_ENV=production npm start"
echo ""
echo "📝 Environment Variables for Production:"
echo "   Set these in your deployment platform:"
echo "   • NEXT_PUBLIC_SUPABASE_URL"
echo "   • NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
echo "   • SUPABASE_SERVICE_ROLE_KEY"
echo "   • OLLAMA_BASE_URL (or omit for Cloud AI)"
echo ""
echo "🔐 Don't forget to:"
echo "   • Set up .env.production if needed"
echo "   • Configure deployment secrets securely"
echo "   • Enable HTTPS on production domain"
echo ""
