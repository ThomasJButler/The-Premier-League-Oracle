# SaaS Operation Guide for Premier League Oracle

## Table of Contents
1. [Overview](#overview)
2. [API Key Management Strategy](#api-key-management-strategy)
3. [Service Tiers](#service-tiers)
4. [Technical Architecture](#technical-architecture)
5. [Monetization Strategies](#monetization-strategies)
6. [Security Considerations](#security-considerations)
7. [Scaling Strategy](#scaling-strategy)

## Overview

The Premier League Oracle operates as a Software-as-a-Service (SaaS) platform providing AI-powered football predictions. This guide outlines how to structure and operate the service while managing API costs and user access.

## API Key Management Strategy

### Current Challenge
Football-Data.org API keys have rate limits and costs:
- **Free Tier**: 10 requests/minute, limited data
- **Paid Tiers**: Starting from €12/month up to €600/month for unlimited

### Solution 1: Proxy Server Architecture (Recommended)

```
User → Your Backend → Football-Data API
```

**Implementation:**
1. **Backend Service** (Node.js/Python/Go)
   - Stores YOUR API key securely
   - Handles all API requests on behalf of users
   - Implements caching to reduce API calls
   - Rate limiting per user
   - Request aggregation

2. **Benefits:**
   - Single API key for all users
   - Complete control over usage
   - Ability to cache and optimize requests
   - Users never see your API key
   - Can implement your own rate limiting

3. **Architecture Example:**
```javascript
// Backend API endpoint
app.get('/api/matches', authenticateUser, async (req, res) => {
  const cached = await cache.get('matches');
  if (cached) return res.json(cached);
  
  const data = await footballDataAPI.getMatches(); // Uses YOUR key
  await cache.set('matches', data, 300); // Cache for 5 minutes
  
  res.json(data);
});
```

### Solution 2: Bring Your Own Key (BYOK)

For premium users who want unlimited access:
- Users provide their own Football-Data.org API key
- Stored encrypted in database per user
- No API costs for you
- Users have full control

## Service Tiers

### Free Tier
- **Access**: Limited predictions (5 per day)
- **Features**: Basic predictions, standings, recent results
- **Data Source**: Cached data, updated every 30 minutes
- **Revenue**: Ads or upgrade prompts

### Basic Tier (£9.99/month)
- **Access**: 50 predictions per day
- **Features**: All free features + team comparisons, basic statistics
- **Data Source**: Cached data, updated every 10 minutes
- **Revenue**: Subscription

### Pro Tier (£24.99/month)
- **Access**: Unlimited predictions
- **Features**: 
  - Advanced statistics
  - Historical data analysis
  - Betting suggestions with Kelly Criterion
  - Value bet identification
  - Custom alerts
- **Data Source**: Near real-time data (5-minute cache)
- **Revenue**: Subscription

### Enterprise Tier (Custom Pricing)
- **Access**: API access for integration
- **Features**: 
  - Webhook notifications
  - Bulk predictions
  - Custom models
  - White-label options
  - BYOK support
- **Data Source**: Real-time or BYOK
- **Revenue**: Contract-based

## Technical Architecture

### 1. Backend Service (Required for SaaS)

Create a separate backend service to handle:
- API key management
- User authentication
- Rate limiting
- Caching
- Billing

**Technology Stack Options:**
```yaml
Option 1 - Node.js:
  - Express.js or Fastify
  - Redis for caching
  - PostgreSQL for user data
  - Stripe for payments

Option 2 - Python:
  - FastAPI or Django
  - Redis for caching
  - PostgreSQL for user data
  - Stripe for payments

Option 3 - Serverless:
  - Vercel Functions or AWS Lambda
  - Upstash Redis for caching
  - Supabase for database
  - Stripe for payments
```

### 2. Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  subscription_tier TEXT DEFAULT 'free',
  api_calls_today INTEGER DEFAULT 0,
  api_calls_month INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User API keys (for BYOK)
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  encrypted_key TEXT, -- Encrypted Football-Data API key
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- API usage tracking
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  endpoint TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  cached BOOLEAN DEFAULT false,
  response_time_ms INTEGER
);

-- Cached responses
CREATE TABLE cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Caching Strategy

```javascript
class CacheManager {
  constructor() {
    this.defaultTTL = {
      matches: 300,        // 5 minutes
      standings: 3600,     // 1 hour
      predictions: 86400,  // 24 hours
      statistics: 3600     // 1 hour
    };
  }
  
  async get(key, tier = 'free') {
    // Adjust cache TTL based on user tier
    const ttlMultiplier = {
      'free': 1,
      'basic': 0.5,
      'pro': 0.2,
      'enterprise': 0
    };
    
    // Check cache
    const cached = await redis.get(key);
    if (cached && tier !== 'enterprise') {
      return JSON.parse(cached);
    }
    
    return null;
  }
}
```

## Monetization Strategies

### 1. Subscription Model (Primary)
- Monthly recurring revenue
- Predictable income
- Easy to scale

### 2. Credits System (Alternative)
- Users buy prediction credits
- Pay-as-you-go model
- Good for casual users
```javascript
// Example credit costs
const creditCosts = {
  prediction: 1,
  advanced_stats: 2,
  historical_analysis: 5,
  bulk_predictions: 10
};
```

### 3. Affiliate Marketing
- Partner with bookmakers
- Earn commission on referrals
- Additional revenue stream

### 4. Data Licensing
- Sell aggregated prediction data
- License your prediction algorithm
- Enterprise partnerships

### 5. Advertising (Free Tier)
- Display ads for free users
- Sponsored predictions
- Newsletter sponsorships

## Security Considerations

### 1. API Key Security
```javascript
// Never expose API keys in frontend
// Always use environment variables
// Encrypt stored keys

const encryptApiKey = (key) => {
  return crypto.AES.encrypt(key, process.env.ENCRYPTION_SECRET).toString();
};

const decryptApiKey = (encryptedKey) => {
  const bytes = crypto.AES.decrypt(encryptedKey, process.env.ENCRYPTION_SECRET);
  return bytes.toString(crypto.enc.Utf8);
};
```

### 2. Rate Limiting
```javascript
const rateLimit = {
  'free': { requests: 100, window: '1h' },
  'basic': { requests: 500, window: '1h' },
  'pro': { requests: 2000, window: '1h' },
  'enterprise': { requests: 10000, window: '1h' }
};
```

### 3. Authentication
- Use JWT tokens
- Implement refresh tokens
- Session management
- 2FA for premium accounts

## Scaling Strategy

### Phase 1: MVP (0-100 users)
- Single backend server
- Shared Football-Data API key (€99/month tier)
- Basic caching with Redis
- Supabase for database

### Phase 2: Growth (100-1,000 users)
- Load balanced backend (2-3 servers)
- Upgraded API key (€299/month tier)
- CDN for static assets
- Advanced caching strategies

### Phase 3: Scale (1,000+ users)
- Microservices architecture
- Multiple API keys for load distribution
- Enterprise Football-Data agreement
- Custom infrastructure

### Cost Optimization
```javascript
// Intelligent request batching
class RequestBatcher {
  constructor() {
    this.queue = [];
    this.processing = false;
  }
  
  async addRequest(request) {
    this.queue.push(request);
    
    if (!this.processing) {
      this.processing = true;
      setTimeout(() => this.processBatch(), 100);
    }
  }
  
  async processBatch() {
    // Combine similar requests
    const matches = this.queue.filter(r => r.type === 'matches');
    if (matches.length > 0) {
      const data = await this.fetchMatches();
      matches.forEach(r => r.resolve(data));
    }
    
    this.queue = [];
    this.processing = false;
  }
}
```

## Implementation Checklist

### Backend Setup
- [ ] Create backend service (Node.js/Python)
- [ ] Set up PostgreSQL database
- [ ] Implement Redis caching
- [ ] Create API endpoints
- [ ] Add authentication system
- [ ] Implement rate limiting
- [ ] Set up Stripe payments

### Frontend Updates
- [ ] Remove direct API calls
- [ ] Point to your backend API
- [ ] Add authentication UI
- [ ] Create subscription management
- [ ] Add usage dashboard

### Infrastructure
- [ ] Deploy backend to cloud (Vercel, AWS, etc.)
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Configure CDN (Cloudflare)
- [ ] Set up backup systems
- [ ] Create CI/CD pipeline

### Legal & Compliance
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] GDPR compliance
- [ ] Payment processing compliance
- [ ] API usage agreements

## Revenue Projections

### Conservative Estimate
```
100 free users × £0 = £0
20 basic users × £9.99 = £199.80
5 pro users × £24.99 = £124.95
Monthly Revenue: £324.75
Monthly Costs: £99 (API) + £50 (hosting) = £149
Monthly Profit: £175.75
```

### Growth Scenario (6 months)
```
500 free users × £0 = £0
100 basic users × £9.99 = £999
25 pro users × £24.99 = £624.75
2 enterprise × £199 = £398
Monthly Revenue: £2,021.75
Monthly Costs: £299 (API) + £200 (hosting) = £499
Monthly Profit: £1,522.75
```

## Support & Maintenance

### Customer Support
- FAQ section
- Email support for paid tiers
- Discord community
- Video tutorials

### Monitoring
- API usage tracking
- Error monitoring
- Performance metrics
- User behavior analytics

### Updates
- Weekly prediction model improvements
- Monthly feature releases
- Continuous bug fixes
- Seasonal adjustments

## Conclusion

Operating Premier League Oracle as a SaaS requires:
1. **Backend infrastructure** to protect API keys
2. **Tiered access** to manage costs
3. **Smart caching** to minimize API calls
4. **Clear monetization** strategy
5. **Scalable architecture** for growth

The key to success is balancing API costs with user value, starting small with a proxy server setup and scaling based on demand. Focus on providing unique value through your prediction algorithms rather than just API data access.