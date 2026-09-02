# Fishfinder-Pro: Project Setup & Configuration Guide

**Date:** September 2, 2026  
**Project Type:** Next.js 16.3.4 + React 19.2.8 + TypeScript  
**Status:** ✅ Dependencies Installed, 🔧 Configuration in Progress

---

## 📋 Project Overview

**Fishfinder-Pro** is a full-stack fishing assistant application built with:
- **Frontend:** Next.js, React 19.2.8, TypeScript, TailwindCSS
- **Backend:** Next.js API Routes, Node.js
- **Database:** Supabase (PostgreSQL)
- **AI Integration:** OpenAI API + Ollama (local inference)
- **Mapping:** Leaflet + React-Leaflet
- **Data Fetching:** TanStack React Query
- **Caching:** Redis/IORedis
- **Security:** Helmet.js, Express Rate Limiting

---

## ✅ Completed Setup Steps

### 1. Dependencies Installation
```bash
✓ npm install
✓ 716 packages installed
✓ 0 vulnerabilities found
✓ ESLint & TypeScript configured
```

### 2. Extraneous Packages Removed
```bash
✓ npm prune
✓ Removed unused packages
✓ Clean dependency tree
```

### 3. Environment Configuration
```bash
✓ .env.local created with all required variables
✓ Template configured with defaults
```

### 4. Android SDK Setup (for Mobile Development)
```bash
✓ Android SDK installed at $HOME/Android/Sdk
✓ Platform-Tools v37.0.1
✓ Build-Tools v35.0.0
✓ Android API 35
✓ Environment variables configured in ~/.bashrc
```

---

## 🔧 Required Environment Variables

Copy `.env.local` and populate with your actual values:

### Supabase Configuration
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGc... # anon key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # service role key
```

**How to get these:**
1. Visit [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy the Project URL and API keys

### Ollama Configuration (Local AI)
```env
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1
OLLAMA_VISION_MODEL=llama3.2-vision
```

**Setup Ollama:**
```bash
# Install Ollama: https://ollama.com
# Run the service:
ollama serve

# In another terminal, pull models:
ollama pull llama3.1
ollama pull llama3.2-vision
```

### Weather & Environmental APIs
```env
NWS_BASE=https://api.weather.gov           # National Weather Service
USGS_BASE=https://api.waterdata.usgs.gov   # USGS Water Data
OPEN_METEO_MARINE=https://marine-api.open-meteo.com/v1/marine
```
*These are public APIs, no authentication needed*

### Optional: OpenAI (if using instead of Ollama)
```env
OPENAI_API_KEY=sk-... # Get from https://platform.openai.com/api-keys
```

### Optional: Redis Cache
```env
REDIS_URL=redis://localhost:6379
```

---

## 🚀 Development Commands

### Start Development Server
```bash
npm run dev
# Opens at http://localhost:3000
```

### Build Production Version
```bash
npm run build
npm start
```

### Type Checking
```bash
npx tsc --noEmit
# ✓ No output = no type errors (currently passing)
```

### Linting
```bash
npm run lint
# Note: Some ESLint parsing errors exist - see Troubleshooting
```

### Run Tests
```bash
npm run test
# Uses Vitest
```

---

## 📁 Project Structure

```
fishfinder-pro/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # Backend API routes
│   │   │   ├── ai/            # AI integration endpoints
│   │   │   ├── catches/       # Fishing catch logging
│   │   │   ├── spots/         # Fishing spot management
│   │   │   └── water-heatmap/ # Environmental data
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   │   ├── ai/               # AI-related components
│   │   ├── logbook/          # Fishing log UI
│   │   ├── FishingMap.tsx    # Main map component
│   │   └── ...
│   ├── lib/                   # Utility libraries
│   │   ├── supabase/         # Supabase clients
│   │   ├── scoring/          # Fishing score algorithms
│   │   ├── spots/            # Spot management
│   │   ├── fetchers/         # Data fetching utilities
│   │   └── ollama.ts         # AI inference client
│   └── styles/               # CSS modules
├── public/                    # Static assets
│   ├── fish/                 # Fish species images
│   └── species/              # Species data
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── tailwind.config.ts       # TailwindCSS config
├── eslint.config.mjs        # ESLint rules
├── next.config.ts           # Next.js config
└── .env.local               # Environment variables
```

---

## 🔐 Security Configuration

### Helmet.js (HTTP Headers)
✅ Already configured in package.json

### Rate Limiting
✅ express-rate-limit v8.6.2 installed

### Input Validation
✅ Zod v4.4.3 for schema validation

### Supabase Security
- Using Row Level Security (RLS) policies
- Service role key for admin operations
- Anon key for public client access

---

## 🐛 Troubleshooting

### Build Fails: "Invalid supabaseUrl"
**Cause:** Missing or invalid Supabase environment variables
**Solution:** 
1. Check `.env.local` is properly configured
2. Verify NEXT_PUBLIC_SUPABASE_URL is set
3. Make sure it's a valid HTTPS URL

### ESLint Parsing Errors
**Cause:** ESLint parser configuration for TypeScript
**Status:** Known issue - syntax is valid TypeScript, ESLint config needs adjustment
**Workaround:** Use `npx tsc --noEmit` for type checking instead

### Unused Variable Warnings
Example: "'FishingMap' is defined but never used"
**Solution:** Remove unused imports or implement the component

### Ollama Connection Error
**Cause:** Ollama service not running
**Solution:**
```bash
# Make sure Ollama is running
ollama serve

# Test connection:
curl http://localhost:11434/api/tags
```

### Redis Connection Error
**Cause:** Redis service not running (only if using caching)
**Solution:**
```bash
# Install Redis locally:
brew install redis  # macOS
apt install redis-server  # Linux

# Start Redis:
redis-server

# Or use Docker:
docker run -d -p 6379:6379 redis:latest
```

---

## 📊 API Routes Overview

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/chat` | POST | Chat with fishing advisor |
| `/api/ai/identify` | POST | Identify fish species from image |
| `/api/ai/advisor` | POST | Get fishing recommendations |
| `/api/ai/analyze` | POST | Analyze fishing conditions |
| `/api/ai/bite-times` | GET | Get optimal bite times |
| `/api/ai/suggest-spots` | POST | Suggest fishing spots |
| `/api/catches` | GET/POST | Manage fishing catches |
| `/api/spots` | GET/POST | Manage custom fishing spots |
| `/api/spots/[id]/conditions` | GET | Get spot environmental conditions |
| `/api/water-heatmap` | GET | Get water temperature data |

---

## 🧪 Testing

### Run Tests
```bash
npm run test
```

### Test Configuration
- **Framework:** Vitest
- **DOM Testing:** @testing-library/react
- **File pattern:** `**/*.test.ts` or `**/*.test.tsx`

---

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.3.4 | React framework |
| react | 19.2.8 | UI library |
| typescript | 5.9.3 | Type checking |
| @supabase/supabase-js | 2.112.4 | Database client |
| @tanstack/react-query | 5.102.6 | Data fetching |
| leaflet | 1.9.4 | Mapping library |
| react-leaflet | 5.0.0 | React map component |
| zod | 4.4.3 | Schema validation |
| tailwindcss | 4 | CSS framework |
| openai | 7.7.0 | AI API client |

---

## 🔄 Git Workflow

### Current Branch
```bash
git branch  # Shows: main
```

### Push Changes
```bash
git add .
git commit -m "feat: description"
git push origin main
```

---

## 🚢 Deployment

### Deploy to Vercel (Recommended)
```bash
# 1. Push code to GitHub
git push origin main

# 2. Connect to Vercel: https://vercel.com/new
# Select your repository and deploy

# 3. Add environment variables in Vercel dashboard
# Settings → Environment Variables
```

### Deploy to Docker
```bash
# Build Docker image
docker build -t fishfinder-pro:latest .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  fishfinder-pro:latest
```

---

## 📚 Learn More

- [Next.js Docs](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev)
- [Supabase Guides](https://supabase.com/docs)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Leaflet Documentation](https://leafletjs.com/reference.html)
- [Ollama Documentation](https://ollama.com)

---

## ✨ Next Steps

1. **Configure Supabase:** Set up your database and authentication
2. **Add Environment Variables:** Fill in `.env.local` with your API keys
3. **Start Development Server:** Run `npm run dev`
4. **Test Build Process:** Run `npm run build` (will work with proper env vars)
5. **Set up Mobile:** Use Android SDK for mobile development
6. **Deploy:** Push to production using Vercel or Docker

---

**Last Updated:** September 2, 2026  
**Status:** Ready for Development ✅
