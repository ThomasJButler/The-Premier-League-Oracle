# 🔑 API Keys Configuration Guide

A comprehensive guide for setting up all API keys in The Premier League Oracle.

## 📋 Quick Start (5 minutes)

### Essential Steps:
1. **Get Football-Data.org API Key** (Required - 2 mins)
2. **Add to `.env` file** (30 seconds)
3. **Configure AI Assistant** (Optional - 2 mins)
4. **Test everything works** (30 seconds)

---

## 🎯 Required API Keys

### 1. Football-Data.org API Key (Primary Data Source)

#### 📍 Where to Get It:
1. Visit: https://www.football-data.org/client/register
2. Fill in the registration form:
   - Email address
   - Name
   - Purpose: Select "Non-Commercial"
3. Check your email for the API key
4. **Free tier includes**:
   - ✅ Premier League data
   - ✅ 10 requests per minute
   - ✅ Current season + historical data
   - ✅ Fixtures, results, standings

#### 🔧 How to Add It:
```bash
# In your .env file (root directory)
VITE_FOOTBALL_DATA_API_KEY=your_api_key_here
```

#### ✅ Test It Works:
```bash
# Restart your dev server
npm run dev

# Check the console for:
"Football-Data API connected successfully"
```

---

## 🤖 Optional API Keys (Enhance Your Experience)

### 2. OpenAI API Key (AI Assistant - GPT Models)

#### 📍 Where to Get It:
1. Visit: https://platform.openai.com/signup
2. Sign up or log in
3. Go to: https://platform.openai.com/api-keys
4. Click "Create new secret key"
5. Copy immediately (won't be shown again!)

#### 💰 Costs:
- **GPT-4 Turbo**: ~£0.008 per 1K tokens (~£0.01 per request)
- **GPT-3.5 Turbo**: ~£0.0008 per 1K tokens (~£0.001 per request)
- **Typical monthly cost**: £5-10 for regular use

#### 🔧 How to Add It:
1. Open The Premier League Oracle in your browser
2. Click on "AI Assistant" in sidebar
3. Click "Settings" button (top right)
4. Select "OpenAI" as provider
5. Choose your model (GPT-4 recommended)
6. Paste your API key
7. Click "Save"

**Note**: API key is stored locally in your browser, never sent to our servers!

---

### 3. Anthropic API Key (AI Assistant - Claude Models)

#### 📍 Where to Get It:
1. Visit: https://console.anthropic.com/
2. Sign up or log in
3. Go to Account → API Keys
4. Generate new key
5. Copy the key (starts with `sk-ant-`)

#### 💰 Costs:
- **Claude 3 Opus**: ~£0.012 per 1K tokens
- **Claude 3 Sonnet**: ~£0.002 per 1K tokens
- **Claude 3 Haiku**: ~£0.0002 per 1K tokens
- **Typical monthly cost**: £5-15 for regular use

#### 🔧 How to Add It:
Same as OpenAI, but select "Anthropic" as provider in the AI Assistant settings.

---

## 🔮 Future API Keys (Coming Soon)

### 4. Odds-API Key (Enhanced Betting Data)
- **Purpose**: Real-time odds from multiple bookmakers
- **Get it from**: https://the-odds-api.com/
- **Cost**: Free tier available (500 requests/month)
- **Add to**: `.env` as `VITE_ODDS_API_KEY`

### 5. OpenWeatherMap API Key (Weather Impact)
- **Purpose**: Weather conditions for match predictions
- **Get it from**: https://openweathermap.org/api
- **Cost**: Free tier (1000 requests/day)
- **Add to**: `.env` as `VITE_WEATHER_API_KEY`

---

## 📁 File Structure

```
The-Premier-League-Oracle/
├── .env                    # Your API keys (never commit this!)
├── .env.example           # Template for API keys
└── src/
    └── services/
        ├── aiService.ts   # Uses AI API keys
        └── api/
            └── footballData.ts  # Uses Football-Data key
```

---

## 🛠️ Troubleshooting

### Problem: "Invalid API key"
**Solution**: 
- Check for extra spaces in your API key
- Ensure you've saved the `.env` file
- Restart the dev server (`npm run dev`)

### Problem: "Rate limit exceeded"
**Solution**:
- Football-Data.org: Wait 6 seconds between requests (handled automatically)
- OpenAI: Upgrade to paid tier or reduce request frequency

### Problem: "API not connecting"
**Solution**:
1. Check console for specific error messages
2. Verify API key is in correct format
3. Test API directly with curl:
```bash
# Test Football-Data API
curl -X GET "https://api.football-data.org/v4/competitions/2021" \
  -H "X-Auth-Token: YOUR_API_KEY"
```

### Problem: "CORS errors"
**Solution**: 
- This is normal in development
- APIs are called from backend in production
- Use the provided proxy settings in `vite.config.ts`

---

## 💡 Pro Tips

### Managing Costs:
1. **Use GPT-3.5 Turbo** for testing (10x cheaper than GPT-4)
2. **Enable caching** to reduce API calls
3. **Set up billing alerts** in OpenAI/Anthropic dashboards
4. **Use free tiers** where possible

### Security Best Practices:
1. **Never commit `.env`** to git (already in `.gitignore`)
2. **Rotate API keys** regularly
3. **Use environment-specific keys** (dev/staging/production)
4. **Monitor usage** in provider dashboards

### Performance Optimisation:
1. **Enable IndexedDB caching** (on by default)
2. **Use batch requests** where possible
3. **Implement request queuing** for rate limits

---

## 📊 API Features Unlocked

| API Key | Features Enabled | Cost |
|---------|-----------------|------|
| Football-Data.org | Live fixtures, results, standings, team stats | Free |
| OpenAI | Advanced match analysis, natural language queries | £5-10/month |
| Anthropic | Alternative AI provider, Claude models | £5-15/month |
| Odds-API | Multi-bookmaker odds, arbitrage detection | Free/Paid |
| Weather | Weather impact on predictions | Free |

---

## 🆘 Need Help?

### Documentation:
- Football-Data.org: https://www.football-data.org/documentation/quickstart
- OpenAI: https://platform.openai.com/docs
- Anthropic: https://docs.anthropic.com

### Support:
- GitHub Issues: https://github.com/ThomasJButler/The-Premier-League-Oracle/issues
- API-specific support: Check provider websites

---

## 🚀 What Happens After Setup?

Once your API keys are configured:

1. **Football-Data API**: 
   - Dashboard shows live Premier League data
   - Matches update automatically
   - No more manual data entry!

2. **AI Assistant**:
   - Get intelligent match analysis
   - Ask complex questions about teams
   - Receive betting recommendations

3. **Combined Power**:
   - AI analyses real-time match data
   - Kelly Criterion with live odds
   - Value bets identified automatically

---

*Last updated: 14th August 2025*
*The Premier League Oracle v2.0 - Your journey to smarter predictions starts here!*