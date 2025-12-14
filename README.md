# IdeaFlow - AI-Powered Workflow Builder

Transform your ideas into actionable, visual workflows with AI assistance. IdeaFlow helps you break down complex ideas into structured research workflows that you can execute, edit, and export.

## Features

- **AI-Powered Workflow Generation**: Describe your idea in plain language and get a structured workflow automatically generated
- **Interactive Visual Canvas**: Drag, drop, and connect nodes in an intuitive React Flow interface
- **Voice Input Support**: Speak your ideas using Groq Cloud Whisper for hands-free workflow creation
- **Research Integration**: Each workflow node performs targeted web research using Tavily API
- **Real-time Execution**: Run workflows step-by-step with AI-generated content and context sharing
- **Export Options**: Download workflows as JSON, PDF, or text files
- **Secure API Key Management**: Store your API keys securely with encryption
- **Rate Limiting**: Built-in protection for cloud API keys (2 requests/minute for free tier)

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- API keys for:
  - [OpenRouter](https://openrouter.ai/) (for AI workflow generation)
  - [Groq](https://console.groq.com/) (for voice transcription)
  - [Tavily](https://tavily.com/) (for web research)
- [Convex](https://convex.dev/) account (for secure API key storage)

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd main
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Add your environment variables to `.env.local` (see [Environment Variables](#environment-variables) section)

5. Set up Convex:
```bash
npx convex dev
```
This will guide you through Convex setup. After setup, you'll get:
- `NEXT_PUBLIC_CONVEX_URL` - Add this to your `.env.local`
- `CONVEX_DEPLOY_KEY` - Add this to your `.env.local`

6. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

### Required API Keys

- **`OPENROUTER_API_KEY`**: Your OpenRouter API key for AI workflow generation
  - Get it from: https://openrouter.ai/keys
  - Used for: Generating workflow structures and executing nodes

- **`GROQ_API_KEY`**: Your Groq API key for voice transcription
  - Get it from: https://console.groq.com/keys
  - Used for: Converting voice input to text (uses `whisper-large-v3-turbo` model)

- **`TAVILY_API_KEY`**: Your Tavily API key for web research
  - Get it from: https://tavily.com/
  - Used for: Performing web searches in workflow nodes

### Convex Configuration

- **`NEXT_PUBLIC_CONVEX_URL`**: Your Convex deployment URL
  - Found in your Convex dashboard after deployment
  - Format: `https://your-project.convex.cloud`

- **`CONVEX_DEPLOY_KEY`**: Your Convex deploy key
  - Found in your Convex dashboard settings
  - Used for: Deploying Convex functions

### Application Configuration

- **`NEXT_PUBLIC_APP_URL`**: Your production application URL
  - For local development: `http://localhost:3000`
  - For production: `https://your-domain.com`

- **`NODE_ENV`**: Environment mode
  - Use `development` for local development
  - Use `production` for production deployment

## Production Deployment

### 1. Build the Application

```bash
npm run build
```

This will create an optimized production build. TypeScript and ESLint errors are ignored during build.

### 2. Deploy to Vercel (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Import your repository in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.example`
4. Deploy

### 3. Deploy Convex Functions

```bash
npx convex deploy --prod
```

Make sure your `CONVEX_DEPLOY_KEY` is set in your production environment.

### 4. Environment Variables for Production

Add these in your hosting platform (Vercel, Railway, etc.):

**Required:**
- `OPENROUTER_API_KEY`
- `GROQ_API_KEY`
- `TAVILY_API_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOY_KEY`
- `NEXT_PUBLIC_APP_URL` (your production domain)
- `NODE_ENV=production`

**Optional (for enhanced security):**
- Set `NODE_ENV=production` to enable production optimizations

## API Key Management

### Using Cloud Keys (Environment Variables)

- API keys stored in environment variables are shared across all users
- Rate limited to 2 requests per minute per session
- Suitable for: Testing, demos, or low-traffic applications

### Using User-Provided Keys

- Users can add their own API keys in Settings
- Keys are encrypted and stored securely in Convex
- No rate limiting for users with their own keys
- Keys are automatically deleted when sessions end

**To use your own keys:**
1. Click the Settings icon (gear) in the top-right corner
2. Enter your API keys for Groq and OpenRouter
3. Click "Save API Keys"
4. Your keys will be used for all subsequent requests

## Usage

### Creating a Workflow

1. **Text Input**: Type your idea in the input field and click "Generate"
2. **Voice Input**: Click the microphone icon and speak your idea
3. The AI will generate a structured workflow with research nodes

### Editing Workflows

- **Text Edit**: Click the "Edit" button in the bottom status bar, modify your prompt
- **Voice Edit**: Click the "Voice" button and speak your changes
- **Node Edit**: Click any node on the canvas to view/edit its details

### Running Workflows

1. Click the "Run Flow" button in the top toolbar
2. Nodes will execute sequentially, sharing context between steps
3. View outputs in the right panel or in the "Output" modal

### Exporting Workflows

1. Click "Export" in the left toolkit panel
2. Choose format: JSON, PDF, or Text
3. Download your workflow

## Rate Limiting

When using cloud API keys (environment variables):
- **Limit**: 2 requests per minute per session
- **Scope**: Applies to both workflow generation and node execution
- **Bypass**: Add your own API keys in Settings to avoid rate limits

Rate limit errors will show a toast notification with:
- Time remaining until reset
- Suggestion to use your own API keys

## Troubleshooting

### Build Errors

TypeScript and ESLint errors are ignored during production builds. If you encounter build issues:

1. Check that all environment variables are set
2. Verify Convex is properly configured
3. Ensure all dependencies are installed: `npm install`

### API Key Issues

- **"API Keys Required" modal appears**: Add your API keys in Settings or ensure environment variables are set
- **Rate limit errors**: Wait for the cooldown period or add your own API keys
- **Invalid API key errors**: Verify your keys are correct and have sufficient credits

### Convex Errors

- **"Could not find public function"**: Run `npx convex dev` to sync functions
- **Connection errors**: Verify `NEXT_PUBLIC_CONVEX_URL` is correct
- **Deploy errors**: Check that `CONVEX_DEPLOY_KEY` is set correctly

### Voice Input Not Working

- Check browser permissions for microphone access
- Verify `GROQ_API_KEY` is set correctly
- Ensure you're using a browser that supports Web Audio API

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **UI Components**: shadcn/ui, Radix UI
- **Flow Visualization**: React Flow (xyflow)
- **AI Integration**: OpenRouter (multiple model support)
- **Voice**: Groq Cloud Whisper
- **Research**: Tavily API
- **Database**: Convex (for secure key storage)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion, Three.js, OGL

## Support

For issues, questions, or contributions, please open an issue on the repository.

## License

See LICENSE file for details.
