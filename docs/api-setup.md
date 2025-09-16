# API Setup Guide

This guide will walk you through setting up your Football-Data.org API key to access live Premier League data.

## Why Do I Need an API Key?

Premier League Oracle has transitioned from using static sample data to live, real-time Premier League data. This means:

- ✅ **Always Current**: Latest match results, fixtures, and statistics
- ✅ **Official Data**: Direct from Football-Data.org's authoritative database
- ✅ **Real-time Updates**: Live scores and immediate post-match data
- ✅ **Comprehensive Coverage**: All Premier League teams, players, and statistics

## Getting Your Free API Key

### Step 1: Register with Football-Data.org

1. **Visit**: [https://www.football-data.org/client/register](https://www.football-data.org/client/register)
2. **Fill out the registration form**:
   - Email address
   - Choose a password
   - Agree to terms of service
3. **Verify your email**: Check your inbox for a verification email
4. **Complete setup**: Follow the email link to activate your account

### Step 2: Get Your API Key

1. **Log in** to your Football-Data.org account
2. **Navigate** to your dashboard/profile
3. **Copy your API key** (it's a long string of letters and numbers)
4. **Keep it safe** - you'll need it for Premier League Oracle

### Step 3: Add to Premier League Oracle

**First Time Users:**
- The setup wizard will appear automatically
- Follow the steps until you reach "API Configuration"
- Paste your API key and click "Validate & Save"

**Existing Users:**
- Go to **Settings** (⚙️ icon in sidebar)
- Find the **Data Source** section
- Click **Update API Key**
- Paste your new key and save

## API Key Validation

When you enter your API key, Premier League Oracle will:

1. **Test the connection** to Football-Data.org
2. **Verify permissions** for Premier League data
3. **Check rate limits** to ensure smooth operation
4. **Save locally** in your browser (never sent to our servers)

## Free Tier Limitations

The free Football-Data.org tier includes:

- **10 requests per minute**: Perfect for normal browsing
- **Competition access**: Full Premier League data
- **No daily limits**: Use as much as you need within rate limits
- **All match data**: Fixtures, results, statistics

## Rate Limiting & Performance

Premier League Oracle automatically handles rate limiting:

- **Smart Caching**: Stores data locally to reduce API calls
- **Background Updates**: Refreshes data when needed
- **Error Handling**: Graceful fallbacks if rate limits are exceeded

## Troubleshooting

### "Invalid API Key" Error
- **Check for typos**: API keys are case-sensitive
- **Verify your account**: Ensure email verification is complete
- **Key status**: Check if your key is active on Football-Data.org

### "Rate Limit Exceeded"
- **Wait a minute**: Free tier allows 10 requests per minute
- **Clear cache**: Go to Settings → Clear Cache to reset
- **Normal usage**: Avoid rapidly clicking between pages

### "No Data Available"
- **Check internet connection**: Ensure you're online
- **API status**: Football-Data.org may be under maintenance
- **Try again later**: Temporary issues usually resolve quickly

## Privacy & Security

Your API key is handled with maximum security:

- **Local Storage Only**: Never sent to Premier League Oracle servers
- **Browser-Based**: Stored in your browser's local storage
- **No Tracking**: We can't see or access your API key
- **You Control**: Delete or change it anytime in Settings

## Updating Your API Key

To change or update your API key:

1. **Go to Settings** in Premier League Oracle
2. **Find Data Source section**
3. **Click "Update API Key"**
4. **Enter your new key**
5. **Save changes**

The app will automatically refresh with the new key.

## Need Help?

- **Setup Wizard**: Re-run anytime from Settings
- **Football-Data.org Support**: For API key issues
- **GitHub Issues**: For Premier League Oracle bugs
- **Documentation**: Check other guides in `/docs`

Ready to access live Premier League data? Get your API key and start making predictions! ⚽️