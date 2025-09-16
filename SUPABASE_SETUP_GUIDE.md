# Supabase Setup Guide for Premier League Oracle

## Table of Contents
1. [Overview](#overview)
2. [Initial Setup](#initial-setup)
3. [Database Schema](#database-schema)
4. [Setting Up Tables](#setting-up-tables)
5. [Row Level Security (RLS)](#row-level-security)
6. [API Integration](#api-integration)
7. [Automated Predictions](#automated-predictions)
8. [Push Notifications](#push-notifications)
9. [Testing](#testing)

## Overview

This guide will help you set up Supabase as the backend for Premier League Oracle to:
- Store predictions persistently
- Track prediction accuracy over time
- Send weekly prediction notifications
- Maintain historical data for analysis

## Initial Setup

### 1. Create Supabase Account
1. Go to [supabase.com](https://supabase.com)
2. Sign up for free account (provides 500MB database, perfect for starting)
3. Create a new project named "premier-league-oracle"
4. Choose region closest to your users (e.g., London for UK)
5. Set a strong database password and save it securely

### 2. Get Your API Keys
After project creation, go to Settings → API:
- **Project URL**: `https://[YOUR-PROJECT-ID].supabase.co`
- **Anon/Public Key**: Safe to use in frontend
- **Service Role Key**: Keep secret, use only in backend

### 3. Install Supabase Client
```bash
npm install @supabase/supabase-js
```

## Database Schema

### Complete SQL Schema
Run this in the SQL Editor (SQL → New Query):

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams table (reference data)
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  short_name TEXT,
  logo_url TEXT,
  stadium TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  external_id INTEGER UNIQUE, -- Football-Data.org match ID
  home_team_id INTEGER REFERENCES teams(id),
  away_team_id INTEGER REFERENCES teams(id),
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  matchday INTEGER,
  status TEXT, -- SCHEDULED, LIVE, FINISHED
  home_score INTEGER,
  away_score INTEGER,
  result TEXT, -- H, D, A
  season TEXT DEFAULT '2024-25',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id),
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  match_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Prediction details
  predicted_result TEXT NOT NULL, -- H, D, A
  predicted_home_score INTEGER NOT NULL,
  predicted_away_score INTEGER NOT NULL,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Betting suggestions
  recommended_bet TEXT, -- home_win, away_win, draw, over_2.5, btts
  stake_percentage DECIMAL(4,2), -- Kelly Criterion suggestion
  expected_value DECIMAL(10,2),
  
  -- Odds at time of prediction
  home_odds DECIMAL(6,2),
  draw_odds DECIMAL(6,2),
  away_odds DECIMAL(6,2),
  
  -- Model details
  elo_rating_diff DECIMAL(10,2),
  form_score_home DECIMAL(4,2),
  form_score_away DECIMAL(4,2),
  h2h_advantage TEXT, -- home, away, neutral
  
  -- Tracking
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  profit DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for performance
CREATE INDEX idx_predictions_match_date ON predictions(match_date);
CREATE INDEX idx_predictions_created_at ON predictions(created_at);
CREATE INDEX idx_matches_match_date ON matches(match_date);
CREATE INDEX idx_matches_status ON matches(status);

-- Prediction accuracy tracking (aggregated weekly)
CREATE TABLE IF NOT EXISTS prediction_accuracy (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy_percentage DECIMAL(5,2),
  
  -- Detailed breakdown
  home_wins_predicted INTEGER DEFAULT 0,
  home_wins_correct INTEGER DEFAULT 0,
  draws_predicted INTEGER DEFAULT 0,
  draws_correct INTEGER DEFAULT 0,
  away_wins_predicted INTEGER DEFAULT 0,
  away_wins_correct INTEGER DEFAULT 0,
  
  -- Financial performance
  total_stake DECIMAL(10,2) DEFAULT 0,
  total_return DECIMAL(10,2) DEFAULT 0,
  roi DECIMAL(8,2), -- Return on Investment percentage
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- User notification preferences (for future)
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE,
  push_token TEXT,
  notify_predictions BOOLEAN DEFAULT true,
  notify_results BOOLEAN DEFAULT true,
  notify_weekly_summary BOOLEAN DEFAULT true,
  preferred_time TIME DEFAULT '10:00:00',
  timezone TEXT DEFAULT 'Europe/London',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Audit log for tracking changes
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
```

### Create Update Triggers
```sql
-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_predictions_updated_at BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Create Functions for Prediction Management
```sql
-- Function to update prediction results
CREATE OR REPLACE FUNCTION update_prediction_result(
  p_match_id INTEGER,
  p_home_score INTEGER,
  p_away_score INTEGER
)
RETURNS void AS $$
DECLARE
  v_actual_result TEXT;
BEGIN
  -- Determine actual result
  IF p_home_score > p_away_score THEN
    v_actual_result := 'H';
  ELSIF p_home_score < p_away_score THEN
    v_actual_result := 'A';
  ELSE
    v_actual_result := 'D';
  END IF;
  
  -- Update match
  UPDATE matches 
  SET home_score = p_home_score,
      away_score = p_away_score,
      result = v_actual_result,
      status = 'FINISHED'
  WHERE id = p_match_id;
  
  -- Update predictions
  UPDATE predictions
  SET is_correct = (predicted_result = v_actual_result),
      points_earned = CASE 
        WHEN predicted_result = v_actual_result THEN 3
        WHEN predicted_home_score = p_home_score AND predicted_away_score = p_away_score THEN 5
        ELSE 0
      END
  WHERE match_id = p_match_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate weekly accuracy
CREATE OR REPLACE FUNCTION calculate_weekly_accuracy(p_week_start DATE)
RETURNS void AS $$
DECLARE
  v_stats RECORD;
BEGIN
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
    SUM(CASE WHEN predicted_result = 'H' THEN 1 ELSE 0 END) as home_predicted,
    SUM(CASE WHEN predicted_result = 'H' AND is_correct THEN 1 ELSE 0 END) as home_correct,
    SUM(CASE WHEN predicted_result = 'D' THEN 1 ELSE 0 END) as draw_predicted,
    SUM(CASE WHEN predicted_result = 'D' AND is_correct THEN 1 ELSE 0 END) as draw_correct,
    SUM(CASE WHEN predicted_result = 'A' THEN 1 ELSE 0 END) as away_predicted,
    SUM(CASE WHEN predicted_result = 'A' AND is_correct THEN 1 ELSE 0 END) as away_correct
  INTO v_stats
  FROM predictions
  WHERE match_date >= p_week_start 
    AND match_date < p_week_start + INTERVAL '7 days'
    AND is_correct IS NOT NULL;
  
  INSERT INTO prediction_accuracy (
    week_start,
    week_end,
    total_predictions,
    correct_predictions,
    accuracy_percentage,
    home_wins_predicted,
    home_wins_correct,
    draws_predicted,
    draws_correct,
    away_wins_predicted,
    away_wins_correct
  ) VALUES (
    p_week_start,
    p_week_start + INTERVAL '6 days',
    v_stats.total,
    v_stats.correct,
    CASE WHEN v_stats.total > 0 
      THEN ROUND((v_stats.correct::DECIMAL / v_stats.total) * 100, 2)
      ELSE 0 
    END,
    v_stats.home_predicted,
    v_stats.home_correct,
    v_stats.draw_predicted,
    v_stats.draw_correct,
    v_stats.away_predicted,
    v_stats.away_correct
  );
END;
$$ LANGUAGE plpgsql;
```

## Row Level Security (RLS)

Enable RLS for security:

```sql
-- Enable RLS on all tables
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_accuracy ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to predictions" 
  ON predictions FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to matches" 
  ON matches FOR SELECT 
  USING (true);

CREATE POLICY "Allow public read access to accuracy" 
  ON prediction_accuracy FOR SELECT 
  USING (true);

-- For now, use service role key for writes
-- Later, you can add user authentication
```

## API Integration

### 1. Create Supabase Client
Create `/src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface DbMatch {
  id: number;
  external_id: number;
  home_team_name: string;
  away_team_name: string;
  match_date: string;
  matchday: number;
  status: string;
  home_score?: number;
  away_score?: number;
  result?: string;
  season: string;
}

export interface DbPrediction {
  id: string;
  match_id: number;
  home_team: string;
  away_team: string;
  match_date: string;
  predicted_result: string;
  predicted_home_score: number;
  predicted_away_score: number;
  confidence: number;
  recommended_bet?: string;
  stake_percentage?: number;
  expected_value?: number;
  home_odds?: number;
  draw_odds?: number;
  away_odds?: number;
  elo_rating_diff?: number;
  form_score_home?: number;
  form_score_away?: number;
  h2h_advantage?: string;
  is_correct?: boolean;
  points_earned?: number;
  profit?: number;
  created_at: string;
}

export interface DbAccuracy {
  id: number;
  week_start: string;
  week_end: string;
  total_predictions: number;
  correct_predictions: number;
  accuracy_percentage: number;
  roi?: number;
}
```

### 2. Add Environment Variables
Create `.env`:

```bash
VITE_SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Automated Predictions

### 1. Prediction Service
Create `/src/services/supabasePredictionService.ts`:

```typescript
import { supabase } from '../lib/supabase';
import type { Match } from '../types';
import { generatePrediction } from './predictionService';

export class SupabasePredictionService {
  /**
   * Get or create prediction for a match
   */
  async getOrCreatePrediction(match: Match) {
    // Check if prediction exists
    const { data: existing } = await supabase
      .from('predictions')
      .select('*')
      .eq('home_team', match.home_team)
      .eq('away_team', match.away_team)
      .eq('match_date', match.date)
      .single();
    
    if (existing) {
      return existing;
    }
    
    // Generate new prediction
    const prediction = await generatePrediction(match);
    
    // Save to Supabase
    const { data, error } = await supabase
      .from('predictions')
      .insert({
        home_team: match.home_team,
        away_team: match.away_team,
        match_date: match.date,
        predicted_result: prediction.result,
        predicted_home_score: prediction.homeScore,
        predicted_away_score: prediction.awayScore,
        confidence: prediction.confidence,
        recommended_bet: prediction.recommendedBet,
        stake_percentage: prediction.kellyPercentage,
        expected_value: prediction.expectedValue,
        elo_rating_diff: prediction.eloRatingDiff,
        form_score_home: prediction.formScoreHome,
        form_score_away: prediction.formScoreAway
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error saving prediction:', error);
      throw error;
    }
    
    return data;
  }
  
  /**
   * Update prediction with actual result
   */
  async updateWithResult(matchId: number, homeScore: number, awayScore: number) {
    // Call the database function
    const { error } = await supabase
      .rpc('update_prediction_result', {
        p_match_id: matchId,
        p_home_score: homeScore,
        p_away_score: awayScore
      });
    
    if (error) {
      console.error('Error updating result:', error);
    }
  }
  
  /**
   * Get accuracy statistics
   */
  async getAccuracyStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabase
      .from('prediction_accuracy')
      .select('*')
      .gte('week_start', startDate.toISOString())
      .order('week_start', { ascending: false });
    
    if (error) {
      console.error('Error fetching accuracy:', error);
      return null;
    }
    
    return data;
  }
  
  /**
   * Generate weekly predictions for all upcoming matches
   */
  async generateWeeklyPredictions() {
    // Get upcoming matches for next 7 days
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'SCHEDULED')
      .lte('match_date', endDate.toISOString())
      .order('match_date');
    
    if (!matches) return;
    
    const predictions = [];
    for (const match of matches) {
      try {
        const prediction = await this.getOrCreatePrediction(match);
        predictions.push(prediction);
      } catch (error) {
        console.error(`Failed to generate prediction for ${match.home_team} vs ${match.away_team}:`, error);
      }
    }
    
    return predictions;
  }
}

export const supabasePredictionService = new SupabasePredictionService();
```

## Push Notifications

### 1. Edge Functions for Weekly Predictions
Create a Supabase Edge Function for automated weekly predictions:

```typescript
// supabase/functions/weekly-predictions/index.ts
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);

Deno.serve(async (req) => {
  // Get upcoming matches
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'SCHEDULED')
    .gte('match_date', new Date().toISOString())
    .lte('match_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('match_date');
  
  if (!matches || matches.length === 0) {
    return new Response('No upcoming matches', { status: 200 });
  }
  
  // Generate predictions for each match
  const predictions = [];
  for (const match of matches) {
    // Call your prediction generation logic
    const prediction = await generatePrediction(match);
    
    // Save to database
    await supabase
      .from('predictions')
      .insert(prediction);
    
    predictions.push(prediction);
  }
  
  // Get notification subscribers
  const { data: subscribers } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('notify_predictions', true);
  
  // Send email notifications
  if (subscribers && subscribers.length > 0) {
    for (const subscriber of subscribers) {
      await resend.emails.send({
        from: 'Premier League Oracle <predictions@yourdomain.com>',
        to: subscriber.email,
        subject: '⚽ Your Weekly Premier League Predictions',
        html: generateEmailHtml(predictions)
      });
    }
  }
  
  return new Response(
    JSON.stringify({ predictions: predictions.length, notified: subscribers?.length || 0 }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

function generatePrediction(match: any) {
  // Your prediction logic here
  // This should match your frontend prediction algorithm
}

function generateEmailHtml(predictions: any[]) {
  return `
    <h2>Premier League Predictions</h2>
    <table>
      ${predictions.map(p => `
        <tr>
          <td>${p.home_team} vs ${p.away_team}</td>
          <td>${p.predicted_home_score} - ${p.predicted_away_score}</td>
          <td>Confidence: ${(p.confidence * 100).toFixed(0)}%</td>
        </tr>
      `).join('')}
    </table>
  `;
}
```

### 2. Schedule the Function
Set up a weekly cron job in Supabase Dashboard:
1. Go to Edge Functions
2. Deploy the weekly-predictions function
3. Set up a trigger: Every Friday at 10:00 AM

## Testing

### Test Data
Insert sample data for testing:

```sql
-- Insert sample teams
INSERT INTO teams (name, short_name) VALUES
  ('Arsenal', 'ARS'),
  ('Chelsea', 'CHE'),
  ('Liverpool', 'LIV'),
  ('Manchester City', 'MCI'),
  ('Manchester United', 'MUN');

-- Insert sample matches
INSERT INTO matches (
  external_id, home_team_name, away_team_name, 
  match_date, matchday, status
) VALUES
  (1001, 'Arsenal', 'Chelsea', NOW() + INTERVAL '2 days', 20, 'SCHEDULED'),
  (1002, 'Liverpool', 'Manchester City', NOW() + INTERVAL '3 days', 20, 'SCHEDULED'),
  (1003, 'Manchester United', 'Arsenal', NOW() - INTERVAL '1 day', 19, 'FINISHED');

-- Test prediction generation
SELECT * FROM predictions;

-- Test accuracy calculation
SELECT calculate_weekly_accuracy(CURRENT_DATE - INTERVAL '7 days');
SELECT * FROM prediction_accuracy;
```

### JavaScript Testing
```javascript
// Test Supabase connection
async function testSupabase() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .limit(5);
  
  console.log('Matches:', data);
  if (error) console.error('Error:', error);
}

// Test prediction creation
async function testPrediction() {
  const prediction = await supabasePredictionService.getOrCreatePrediction({
    id: 1001,
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    date: new Date().toISOString()
  });
  
  console.log('Prediction:', prediction);
}
```

## Monitoring & Maintenance

### 1. Database Metrics
Monitor in Supabase Dashboard:
- Database size
- API request count
- Active connections
- Query performance

### 2. Weekly Tasks
- Review prediction accuracy
- Analyze betting performance
- Check for API issues
- Update team data

### 3. Backup Strategy
- Enable Point-in-Time Recovery (PITR)
- Weekly exports of predictions table
- Store accuracy history long-term

## Cost Considerations

### Free Tier Limits
- 500MB database
- 2GB bandwidth
- 50,000 requests/month

### Optimization Tips
1. Cache predictions locally
2. Batch insert operations
3. Use database functions for complex queries
4. Enable connection pooling

## Next Steps

1. **Set up Supabase project** with the schema above
2. **Add environment variables** to your app
3. **Test the connection** with sample data
4. **Implement prediction service** in frontend
5. **Deploy edge function** for weekly predictions
6. **Set up monitoring** dashboard

This system will:
- Store all predictions permanently
- Track accuracy over time
- Send weekly prediction emails
- Provide historical analysis
- Scale with your user base

The beauty is that predictions are generated once and stored, ensuring consistency and allowing you to track performance over time!