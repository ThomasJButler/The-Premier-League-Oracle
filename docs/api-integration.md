# API Integration Guide

## Football-Data.org API Setup and Configuration

This guide covers the complete setup and integration of the Football-Data.org API with the Premier League Oracle.

## 🔑 Getting Your API Key

### Step 1: Registration

1. Visit [Football-Data.org](https://www.football-data.org/client/register)
2. Fill in the registration form:
   - Email address (required)
   - First name
   - Last name
   - Password

3. Verify your email address
4. Log in to your account

### Step 2: Accessing Your API Key

1. Navigate to your [account dashboard](https://www.football-data.org/client/home)
2. Your API key is displayed at the top
3. Copy the key (looks like: `7cac5e059eaf4111a73b52e727197c1b`)

### Step 3: API Tier Information

**Free Tier Limits:**
- 10 requests per minute
- Access to all major competitions
- Historical data included
- No credit card required

**Benefits of Free Tier:**
- Perfect for personal projects
- All Premier League data available
- Includes live scores and fixtures
- Team and player statistics

## 🛠️ Configuration

### Environment Setup

The application supports two methods of API key configuration:

#### Method 1: Environment Variable (Developers)

Create a `.env` file in the project root:

```bash
VITE_FOOTBALL_DATA_API_KEY=your_api_key_here
```

#### Method 2: In-App Setup (Users)

1. Open the application
2. The setup wizard appears automatically
3. Enter your API key when prompted
4. Click "Validate & Save"

### How It Works

```javascript
// The app checks for API key in this order:
1. Environment variable (VITE_FOOTBALL_DATA_API_KEY)
2. LocalStorage (football_data_api_key)
3. Setup wizard if neither exists
```

## 🔧 Technical Implementation

### API Client Configuration

The Football-Data.org API client is configured in `src/services/api/footballData.ts`:

```typescript
class FootballDataAPI {
  constructor() {
    // Use proxy in development to avoid CORS
    const isDevelopment = import.meta.env.DEV;
    const baseUrl = isDevelopment 
      ? '/api/football-data'  // Proxy endpoint
      : 'https://api.football-data.org/v4'; // Direct API
    
    this.config = {
      apiKey: savedApiKey || envKey,
      baseUrl,
      competitionId: 2021 // Premier League
    };
  }
}
```

### CORS Handling

#### Development Mode

Vite proxy configuration handles CORS in development:

```javascript
// vite.config.ts
proxy: {
  '/api/football-data': {
    target: 'https://api.football-data.org/v4',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api\/football-data/, '')
  }
}
```

#### Production Mode

In production, the app makes direct API calls as CORS is handled by Football-Data.org for authenticated requests.

## 📡 Available Endpoints

### Competition Data

```javascript
// Get Premier League information
GET /competitions/2021

// Get current season
GET /competitions/2021/seasons
```

### Matches

```javascript
// All matches in current season
GET /competitions/2021/matches

// Matches by matchday
GET /competitions/2021/matches?matchday=10

// Upcoming matches
GET /competitions/2021/matches?dateFrom=2024-01-01&dateTo=2024-01-07

// Specific match
GET /matches/{matchId}
```

### Teams & Standings

```javascript
// League standings
GET /competitions/2021/standings

// Team details
GET /teams/{teamId}

// Team matches
GET /teams/{teamId}/matches?limit=10
```

## 🚦 Rate Limiting

### Understanding Limits

- **Free Tier**: 10 requests per minute
- **Counter Reset**: Every 60 seconds
- **Headers to Monitor**:
  ```
  X-Requests-Available-Minute: 9
  X-RequestCounter-Reset: 60
  ```

### Built-in Protection

The app implements intelligent rate limiting:

```javascript
private rateLimitDelay = 6000; // 6 seconds between requests

private async rateLimitedFetch(url: string) {
  const timeSinceLastRequest = Date.now() - this.lastRequestTime;
  
  if (timeSinceLastRequest < this.rateLimitDelay) {
    await new Promise(resolve => 
      setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
    );
  }
  
  this.lastRequestTime = Date.now();
  return fetch(url, { headers: { 'X-Auth-Token': this.apiKey } });
}
```

## 💾 Caching Strategy

### Cache Implementation

The app uses multiple caching layers:

1. **Memory Cache** - Immediate responses
2. **IndexedDB** - Persistent browser storage
3. **5-Minute TTL** - Balance freshness and API limits

```javascript
// Cache configuration
private cache: Map<string, { data: any; timestamp: number }> = new Map();
private cacheTimeout = 5 * 60 * 1000; // 5 minutes

// Check cache before API call
if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
  return cached.data;
}
```

## 🔍 Testing Your Integration

### Using the Test Page

1. Open `http://localhost:5173/test-api.html`
2. Enter your API key
3. Test both direct and proxy endpoints
4. Verify successful responses

### Manual Testing with cURL

```bash
# Test direct API
curl -X GET "https://api.football-data.org/v4/competitions/2021" \
  -H "X-Auth-Token: YOUR_API_KEY"

# Test proxy (development only)
curl -X GET "http://localhost:5173/api/football-data/competitions/2021" \
  -H "X-Auth-Token: YOUR_API_KEY"
```

## 🐛 Troubleshooting

### Common Issues and Solutions

#### CORS Errors

**Problem**: "Access to fetch blocked by CORS policy"

**Solutions**:
1. Ensure you're using the development server (`npm run dev`)
2. Check that the proxy is configured correctly
3. Verify your API key is valid

#### 401 Unauthorized

**Problem**: "Invalid API key"

**Solutions**:
1. Check API key is copied correctly
2. Ensure no extra spaces or characters
3. Verify key in Football-Data.org dashboard

#### 429 Too Many Requests

**Problem**: "Rate limit exceeded"

**Solutions**:
1. Wait 60 seconds before retrying
2. Check for duplicate requests
3. Ensure caching is working
4. Consider upgrading API plan

#### No Data Loading

**Problem**: Dashboard shows no matches

**Solutions**:
1. Check browser console for errors
2. Verify API key in Settings
3. Clear cache and reload
4. Test API with test page

## 📊 Data Structure

### Match Object

```typescript
interface Match {
  id: string;
  date: string;
  home_team: string;
  away_team: string;
  home_goals: number | null;
  away_goals: number | null;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  home_odds?: number;
  draw_odds?: number;
  away_odds?: number;
}
```

### Team Statistics

```typescript
interface TeamStats {
  position: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  form: string; // e.g., "WWLDW"
}
```

## 🔐 Security Best Practices

### API Key Security

1. **Never commit API keys** to version control
2. **Use environment variables** for development
3. **LocalStorage** is acceptable for client-side apps
4. **Rotate keys** if exposed

### Request Security

```javascript
// Always use HTTPS in production
const baseUrl = 'https://api.football-data.org/v4';

// Include auth token in headers, never in URL
headers: {
  'X-Auth-Token': apiKey
}
```

## 🚀 Advanced Usage

### Custom Endpoints

Extend the API client for additional features:

```javascript
// Add custom method to footballData.ts
public async getPlayerStats(playerId: number) {
  return this.fetchWithCache(`/players/${playerId}`);
}
```

### Webhook Integration

For real-time updates (requires paid plan):

```javascript
// Configure webhooks in Football-Data.org dashboard
// Endpoint: https://yourapp.com/api/webhook
// Events: Match updates, goals, cards
```

## 📝 API Response Examples

### Successful Response

```json
{
  "id": 2021,
  "name": "Premier League",
  "currentSeason": {
    "startDate": "2024-08-16",
    "endDate": "2025-05-25",
    "currentMatchday": 15
  }
}
```

### Error Response

```json
{
  "message": "The resource you are looking for does not exist.",
  "error": 404
}
```

## 🔄 Migration from Supabase

If you're upgrading from v1.x (Supabase):

1. **Data Source Change**: Now using Football-Data.org API
2. **Real-time Updates**: Live scores and fixtures
3. **No Database Required**: Direct API integration
4. **Improved Performance**: Client-side caching

## 📚 Additional Resources

- [Football-Data.org Documentation](https://www.football-data.org/documentation/api)
- [API Quickstart Guide](https://www.football-data.org/documentation/quickstart)
- [GitHub Issues](https://github.com/yourusername/The-Premier-League-Oracle/issues)
- [Community Forum](https://www.football-data.org/blog)

---

**Note**: This documentation is for v2.0 of Premier League Oracle using Football-Data.org API. For legacy Supabase documentation, see [v1.x docs](./legacy/supabase-integration.md).