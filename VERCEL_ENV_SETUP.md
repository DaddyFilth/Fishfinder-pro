# Vercel Environment Variables Configuration

This file contains the environment variables needed for Fishfinder-Pro on Vercel.

## How to Use This File

1. **Visit Vercel Dashboard:**
   - Go to https://vercel.com/dashboard
   - Select your Fishfinder-pro project
   - Click "Settings"
   - Select "Environment Variables"

2. **Add Each Variable:**
   Copy the variable name and value pairs below and add them one by one to Vercel

3. **Important:** 
   - Never commit actual values to Git
   - Use Vercel's secure secret management
   - Keep credentials confidential

---

## Required Environment Variables

### NEXT_PUBLIC_SUPABASE_URL
- **Value Type:** URL (Public - safe to expose)
- **Format:** `https://your-project-id.supabase.co`
- **How to Get:**
  1. Go to https://app.supabase.com
  2. Select your project
  3. Click Settings → API
  4. Copy "Project URL"
- **Vercel Environment:** Development, Preview, Production

### NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- **Value Type:** API Key (Public anon key)
- **Format:** Usually starts with `eyJ` (JWT token)
- **How to Get:**
  1. Go to https://app.supabase.com/project/[your-project]/settings/api
  2. Find "anon public" key
  3. Copy the full key value
- **Vercel Environment:** Development, Preview, Production

### SUPABASE_SERVICE_ROLE_KEY
- **Value Type:** Secret API Key (Keep confidential!)
- **Format:** Usually starts with `eyJ` (JWT token)
- **How to Get:**
  1. Go to https://app.supabase.com/project/[your-project]/settings/api
  2. Find "service_role secret" key
  3. Copy the full key value
- **Vercel Environment:** Production ONLY (do not expose in preview/dev)
- **⚠️ SECURITY:** This is a secret - never commit to Git

### OLLAMA_BASE_URL (Optional)
- **Value Type:** URL
- **Default:** `http://localhost:11434/v1`
- **Format:** Base URL to your Ollama instance
- **Only needed if:** Using local Ollama for AI inference
- **If omitted:** Will use OpenAI (requires OPENAI_API_KEY)
- **Vercel Environment:** Development, Preview, Production

### OLLAMA_MODEL (Optional)
- **Value Type:** String
- **Default:** `llama3.1`
- **Examples:** `llama3.1`, `llama2`, `mistral`
- **Only needed if:** Using Ollama for AI
- **Vercel Environment:** Development, Preview, Production

### OLLAMA_VISION_MODEL (Optional)
- **Value Type:** String
- **Default:** `llama3.2-vision`
- **Examples:** `llama3.2-vision`, `llava`
- **Only needed if:** Using Ollama for image analysis
- **Vercel Environment:** Development, Preview, Production

### OPENAI_API_KEY (Optional Alternative to Ollama)
- **Value Type:** Secret API Key
- **Format:** Starts with `sk-`
- **How to Get:**
  1. Go to https://platform.openai.com/api-keys
  2. Create a new API key
  3. Copy the value (you can only see it once!)
- **Only needed if:** NOT using Ollama for AI
- **Vercel Environment:** Production ONLY
- **⚠️ SECURITY:** This is a secret - never commit to Git

---

## Step-by-Step Vercel Setup

### 1. Go to Vercel Environment Variables
```
https://vercel.com/dashboard
  → Select fishfinder-pro
  → Settings
  → Environment Variables
```

### 2. Add NEXT_PUBLIC_SUPABASE_URL
- **Name:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** `https://your-project-id.supabase.co`
- **Environments:** Check Development, Preview, Production

### 3. Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- **Name:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **Value:** Your Supabase anon key
- **Environments:** Check Development, Preview, Production

### 4. Add SUPABASE_SERVICE_ROLE_KEY
- **Name:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** Your Supabase service role secret key
- **Environments:** Check Production ONLY
- **⚠️ Security:** Do NOT check Development/Preview

### 5. (Optional) Add OLLAMA Configuration
If using Ollama for local AI inference:

- **Name:** `OLLAMA_BASE_URL`
  - **Value:** `http://localhost:11434/v1`
  - **Environments:** Your choice

- **Name:** `OLLAMA_MODEL`
  - **Value:** `llama3.1`
  - **Environments:** Your choice

- **Name:** `OLLAMA_VISION_MODEL`
  - **Value:** `llama3.2-vision`
  - **Environments:** Your choice

### 6. (Optional) Add OpenAI Configuration
If NOT using Ollama:

- **Name:** `OPENAI_API_KEY`
  - **Value:** Your OpenAI API key (starts with `sk-`)
  - **Environments:** Production ONLY

---

## Environment Scopes in Vercel

| Scope | Purpose | Recommended |
|-------|---------|-------------|
| **Development** | Local `npm run dev` | Optional - use local .env.local |
| **Preview** | Pull request previews | Recommended |
| **Production** | Live deployment | Required |

### Recommendation
- Development: Skip (use local .env.local instead)
- Preview: Add public keys only
- Production: Add all required variables

---

## Automated Setup Using Vercel CLI

If you prefer command-line setup:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Redeploy with new variables
vercel --prod
```

---

## Testing Your Configuration

After deployment, verify variables are working:

```bash
# Check if deployment is using correct Supabase instance
curl https://your-vercel-url.vercel.app/api/catches

# Should connect to your Supabase database
# If error "Invalid supabaseUrl", check the URL format
```

---

## Security Best Practices

✅ **DO:**
- Use Vercel's built-in secret management
- Set service role key for Production only
- Rotate API keys periodically (every 3 months)
- Use separate API keys for each environment
- Monitor API usage in Supabase/OpenAI dashboards

❌ **DON'T:**
- Commit .env files to Git
- Share API keys via email/chat
- Use the same key for multiple projects
- Log sensitive information
- Commit secrets to version control

---

## Troubleshooting

### Error: "Invalid supabaseUrl: Must be valid HTTP or HTTPS URL"
- **Cause:** Wrong format for `NEXT_PUBLIC_SUPABASE_URL`
- **Fix:** Use format `https://project-id.supabase.co` (with https://)

### Error: "Failed to initialize Supabase client"
- **Cause:** Credentials not set correctly
- **Fix:** Double-check values in Vercel Settings → Environment Variables

### Error: "unauthorized API request"
- **Cause:** Wrong API key or invalid service role
- **Fix:** Verify you're using the correct key from https://app.supabase.com/project/_/settings/api

### Preview deployments fail but production works
- **Cause:** Missing environment variables in Preview scope
- **Fix:** Add at least the public Supabase variables to Preview environment

### Long deployment times
- **Cause:** Vercel rebuilding with new environment variables
- **Fix:** Normal - first deployment with new secrets rebuilds
- **Solution:** Wait for deployment to complete, then test

---

## Example Configuration

Here's what a complete configuration looks like (with fake values):

```
NEXT_PUBLIC_SUPABASE_URL = https://abcdefghij.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (Production only)
OLLAMA_BASE_URL = http://localhost:11434/v1
OLLAMA_MODEL = llama3.1
OLLAMA_VISION_MODEL = llama3.2-vision
```

---

## Next Steps After Adding Variables

1. **Redeploy** - Vercel automatically rebuilds with new variables
2. **Test** - Verify app works at your Vercel URL
3. **Monitor** - Check Vercel logs for any errors
4. **Configure Domain** - Set up custom domain (optional)
5. **Enable Analytics** - Monitor performance and errors

---

## Support

- **Vercel Docs:** https://vercel.com/docs/projects/environment-variables
- **Supabase Docs:** https://supabase.com/docs
- **Project Setup:** See PROJECT_SETUP.md
- **Deployment Guide:** See DEPLOYMENT.md

---

**Last Updated:** September 2, 2026  
**Project:** Fishfinder-Pro  
**Status:** Ready for Vercel deployment
