# Production Deployment Checklist

## Pre-Deployment Steps

### 1. Environment Variables Setup

Create a `.env.local` file (or add to your hosting platform) with:

```bash
# Required API Keys
OPENROUTER_API_KEY=your_openrouter_api_key_here
GROQ_API_KEY=your_groq_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here

# Convex Configuration
NEXT_PUBLIC_CONVEX_URL=your_convex_url_here
CONVEX_DEPLOY_KEY=your_convex_deploy_key_here

# Application URL
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Environment
NODE_ENV=production
```

### 2. Convex Setup

1. Run `npx convex dev` to set up Convex
2. Deploy Convex functions: `npx convex deploy --prod`
3. Copy `NEXT_PUBLIC_CONVEX_URL` from Convex dashboard
4. Get `CONVEX_DEPLOY_KEY` from Convex dashboard settings

### 3. Build Configuration

✅ TypeScript errors are ignored during build (configured in `next.config.ts`)
✅ ESLint errors are ignored during build (configured in `next.config.ts`)

### 4. Test Build Locally

```bash
npm run build
npm run start
```

Verify the production build works correctly.

## Deployment Steps

### For Vercel:

1. **Push to Git**: Commit and push all changes
2. **Import Project**: Go to Vercel dashboard → Import Project
3. **Add Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add all variables from the list above
4. **Deploy**: Click Deploy

### For Other Platforms:

1. Set all environment variables in your platform's dashboard
2. Run build command: `npm run build`
3. Set start command: `npm run start`
4. Deploy

## Post-Deployment Verification

- [ ] Application loads without errors
- [ ] Can generate workflows (test with a simple idea)
- [ ] Voice input works (test microphone permission)
- [ ] Settings drawer opens and can save API keys
- [ ] Workflow execution works end-to-end
- [ ] Rate limiting works (test with cloud keys)
- [ ] Export functionality works (JSON, PDF, Text)

## API Key Management for Production

### Option 1: Cloud Keys (Shared)
- Store keys in environment variables
- All users share the same keys
- Rate limited to 2 requests/minute
- **Best for**: Demos, testing, low-traffic

### Option 2: User Keys (Recommended for Production)
- Users add their own keys in Settings
- Keys stored securely in Convex
- No rate limiting
- **Best for**: Production, high-traffic

## Security Checklist

- [ ] All API keys are in environment variables (never commit to Git)
- [ ] `.env.local` is in `.gitignore`
- [ ] Convex deploy key is secured
- [ ] `NODE_ENV=production` is set
- [ ] HTTPS is enabled (required for microphone access)
- [ ] CORS is properly configured if needed

## Monitoring

Monitor these in production:
- API key usage (OpenRouter, Groq, Tavily)
- Rate limit hits (429 errors)
- Convex function errors
- Build/deployment logs

## Troubleshooting Production Issues

### Build Fails
- Check all environment variables are set
- Verify Convex is deployed
- Check build logs for specific errors

### API Errors
- Verify API keys are correct and have credits
- Check rate limits aren't exceeded
- Verify API endpoints are accessible

### Convex Errors
- Ensure `NEXT_PUBLIC_CONVEX_URL` is correct
- Verify Convex functions are deployed
- Check Convex dashboard for errors

