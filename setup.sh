#!/bin/bash

# Fishfinder-Pro Quick Start Script
# Automates initial development environment setup

set -e

echo "🎣 Fishfinder-Pro Development Setup"
echo "===================================="
echo ""

# Check Node.js
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not installed"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "✓ Node.js ${NODE_VERSION}"

# Check npm
echo "📦 Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm not installed"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo "✓ npm ${NPM_VERSION}"

# Check Java (for Android SDK)
echo "☕ Checking Java..."
if ! command -v java &> /dev/null; then
    echo "⚠️  Java not installed (needed for Android development)"
else
    JAVA_VERSION=$(java -version 2>&1 | grep -oP '(?<=version ")[^"]*' | head -1)
    echo "✓ Java ${JAVA_VERSION}"
fi

# Check Android SDK
echo "🤖 Checking Android SDK..."
if [ -z "$ANDROID_HOME" ]; then
    if [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
        echo "✓ Android SDK found at $ANDROID_HOME"
    else
        echo "⚠️  Android SDK not found (optional for web development)"
    fi
else
    echo "✓ ANDROID_HOME is set: $ANDROID_HOME"
fi

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
npm install
echo "✓ Dependencies installed"

# Check if .env.local exists
echo ""
echo "🔐 Checking environment configuration..."
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found, creating from template..."
    if [ -f ".env.local.example" ]; then
        cp .env.local.example .env.local
        echo "✓ Created .env.local from template"
    else
        cat > .env.local << 'EOF'
# Add your environment variables here
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1
EOF
        echo "✓ Created .env.local template"
    fi
    echo ""
    echo "⚠️  IMPORTANT: Update .env.local with your configuration"
    echo "   - Supabase credentials"
    echo "   - API keys"
    echo "   - Local service URLs"
    echo ""
else
    echo "✓ .env.local exists"
fi

# Run type checking
echo ""
echo "🔍 Running TypeScript type check..."
npx tsc --noEmit
echo "✓ No type errors found"

# Show available commands
echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Available commands:"
echo "  npm run dev      → Start development server (http://localhost:3000)"
echo "  npm run build    → Build for production"
echo "  npm start        → Start production server"
echo "  npm run lint     → Run ESLint"
echo ""
echo "🚀 Next steps:"
echo "  1. Configure .env.local with your API keys"
echo "  2. Run: npm run dev"
echo "  3. Open: http://localhost:3000"
echo ""
echo "📖 See PROJECT_SETUP.md for detailed configuration"
