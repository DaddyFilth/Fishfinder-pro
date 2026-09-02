# Vercel Deployment Checklist

**Project:** Fishfinder-Pro  
**Date:** September 2, 2026  
**Status:** Ready for Vercel

---

## 📋 Pre-Deployment Verification

- [ ] Repository pushed to GitHub
- [ ] All changes committed
- [ ] .env.local NOT in Git (check .gitignore)
- [ ] Local build passes: `npm run build`
- [ ] TypeScript checks pass: `npx tsc --noEmit`
- [ ] No console errors in npm run dev

---

## 🔗 Connect to Vercel

- [ ] Visit https://vercel.com/new
- [ ] Sign in with GitHub
- [ ] Select repository: DaddyFilth/Fishfinder-pro
- [ ] Click Import Project

---

## 🔐 Add Environment Variables

### Step 1: Navigate to Environment Variables
- [ ] Go to Vercel Dashboard
- [ ] Select fishfinder-pro project
- [ ] Click Settings
- [ ] Select "Environment Variables"

### Step 2: Required Variables - Add These

**Variable 1: NEXT_PUBLIC_SUPABASE_URL**
- [ ] Name: `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Value: `https://your-project-id.supabase.co` (from Supabase Settings → API)
- [ ] Check: Development, Preview, Production
- [ ] Click Add

**Variable 2: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY**
- [ ] Name: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- [ ] Value: (Supabase anon key from Settings → API)
- [ ] Check: Development, Preview, Production
- [ ] Click Add

**Variable 3: SUPABASE_SERVICE_ROLE_KEY**
- [ ] Name: `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Value: (Supabase service role secret from Settings → API)
- [ ] Check: **Production ONLY** ⚠️
- [ ] DO NOT check Preview or Development
- [ ] Click Add

### Step 3: Optional Variables

**For Ollama Users (not OpenAI):**
- [ ] Add: `OLLAMA_BASE_URL` = `http://localhost:11434/v1`
- [ ] Add: `OLLAMA_MODEL` = `llama3.1`
- [ ] Add: `OLLAMA_VISION_MODEL` = `llama3.2-vision`

**For OpenAI Users (not Ollama):**
- [ ] Add: `OPENAI_API_KEY` = (your OpenAI key starting with sk-)
- [ ] Check: **Production ONLY** ⚠️

---

## ✅ Deploy

- [ ] All environment variables added
- [ ] Click "Deploy" button
- [ ] Wait for build to complete (usually 2-5 minutes)
- [ ] Check for build errors in deployment logs
- [ ] Deployment should show "Ready"

---

## 🧪 Post-Deployment Verification

- [ ] Click "Visit" to open deployed app
- [ ] Page loads without errors
- [ ] Check browser console (F12) for errors
- [ ] Test Supabase connection (e.g., test API endpoint)
- [ ] Verify map displays correctly
- [ ] Test at least one API route

---

## 📊 Common Post-Deployment Issues

### App won't load
- [ ] Check Vercel deployment logs for errors
- [ ] Verify all environment variables are set
- [ ] Confirm Supabase URL format: `https://project-id.supabase.co`

### "Invalid supabaseUrl" error
- [ ] Check NEXT_PUBLIC_SUPABASE_URL format
- [ ] Must start with https://
- [ ] Should end with .supabase.co

### API endpoints fail
- [ ] Verify SUPABASE_SERVICE_ROLE_KEY is set in Production
- [ ] Check Supabase API is accessible
- [ ] Review Vercel function logs

### Preview deployments fail
- [ ] Add public Supabase variables to Preview environment
- [ ] Secret keys should be Production only

### Slow first request
- [ ] Normal for Next.js serverless functions
- [ ] Subsequent requests will be faster

---

## 🎯 Next Steps After Deployment

### Immediate (Day 1)
- [ ] Test all features work
- [ ] Check error logs
- [ ] Verify database connections
- [ ] Monitor performance

### Short Term (Week 1)
- [ ] Set up custom domain (optional)
- [ ] Enable Vercel Analytics
- [ ] Configure error tracking
- [ ] Set up monitoring

### Ongoing
- [ ] Monitor Vercel logs
- [ ] Check Supabase usage
- [ ] Keep dependencies updated
- [ ] Regular security audits

---

## 🔒 Security Checklist

- [ ] Service role key ONLY in Production environment
- [ ] .env.local NOT committed to Git
- [ ] No secrets in NEXT_PUBLIC_ variables (only anon key)
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] API rate limiting active
- [ ] Helmet.js security headers enabled

---

## 📞 Troubleshooting Resources

| Issue | Resource |
|-------|----------|
| Deployment fails | Check Vercel deployment logs |
| Supabase connection error | Verify credentials and format |
| Environment variable not working | Redeploy after adding variable |
| Need custom domain | Vercel Settings → Domains |
| Performance issues | Enable Vercel Analytics |

---

## 📝 Useful Links

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Console:** https://app.supabase.com
- **Repository:** https://github.com/DaddyFilth/Fishfinder-pro
- **Vercel Docs:** https://vercel.com/docs
- **Deployment Guide:** See DEPLOYMENT.md
- **Environment Setup:** See VERCEL_ENV_SETUP.md

---

## ✨ Checklist Complete?

When all items are checked:
- ✅ App is deployed to Vercel
- ✅ Environment variables configured
- ✅ Verified deployment working
- ✅ Security measures in place
- ✅ Ready for production use

**Status:** 🚀 LIVE ON VERCEL!

---

**Last Updated:** September 2, 2026  
**Project:** Fishfinder-Pro  
**Ready:** Yes ✅
