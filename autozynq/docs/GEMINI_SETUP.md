# Gemini AI Setup Guide

## Quick Start

### 1. Get Your API Key

Visit: **https://makersuite.google.com/app/apikey**

- Sign in with your Google account
- Click "Create API Key"
- Copy the key (starts with `AIza...`)

### 2. Add to Environment

Create or edit `.env.local` in the autozynq folder:

```bash
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX
```

### 3. Test It

```bash
cd autozynq
npx tsx scripts/test-ai-gemini.ts
```

## Available Models

- **gemini-1.5-flash** (Default) - Fastest, most cost-effective
- **gemini-1.5-pro** - Best quality, more expensive
- **gemini-1.0-pro** - Previous generation

## Usage in Workflows

1. Open workflow builder
2. Click "+" button to add node
3. Select "AI Generate Text"
4. Provider is set to "Google Gemini" by default
5. Configure:
   - Model (flash recommended for speed)
   - Prompt (required)
   - System Prompt (optional)
   - Temperature (0-2, default 0.7)
   - Max Tokens (1-8000, default 500)
6. Save and execute!

## Switching Between Providers

You can switch between Gemini and OpenAI in the UI:

- Select **Provider** dropdown in the AI node config
- Choose "Google Gemini" or "OpenAI"
- Model list updates automatically
- Configure as needed

## Gemini vs OpenAI

| Feature | Gemini | OpenAI |
|---------|--------|--------|
| API Key | Free tier available | Requires paid account |
| Setup | https://makersuite.google.com | https://platform.openai.com |
| Env Var | `GEMINI_API_KEY` | `OPENAI_API_KEY` |
| Default Model | gemini-1.5-flash | gpt-4o-mini |
| Max Tokens | 8000 | Varies by model |

## Troubleshooting

### "GEMINI_API_KEY not found"
- Make sure `.env.local` is in the autozynq folder (not root)
- Restart dev server after adding the key: `npm run dev`

### "API error 400"
- Check your API key is valid
- Verify the key in Google AI Studio
- Try regenerating the key

### "Rate limit exceeded"
- You've hit the free tier limit
- Wait a few minutes or upgrade your quota

### Model not available
- Some models require billing enabled
- Start with `gemini-1.5-flash` (always available)

## Free Tier Limits

Gemini free tier includes:
- 15 requests per minute
- 1 million tokens per minute
- 1,500 requests per day

Perfect for development and testing!

## Cost Comparison (as of Jan 2026)

**Gemini 1.5 Flash:**
- Free tier: First 2M tokens/day free
- Paid: ~$0.00035 per 1K tokens

**OpenAI GPT-4o Mini:**
- No free tier
- ~$0.00015 per 1K tokens

For development, Gemini's free tier is ideal!
