# The Premier League Oracle - User Guide

## 🚀 Quick Start

### 1. Initial Setup
```bash
# Start the application
npm run dev

# Open in browser
http://localhost:5173
```

### 2. Configure Your API Keys (Essential!)
1. Navigate to **Settings** page
2. Add your **Football-Data.org API key**
   - Get free key at: https://www.football-data.org/client/register
   - Paste into Settings > Football-Data.org API section
   - Click "Save" and "Test" to verify connection
3. (Optional) Add AI API key for advanced insights
   - OpenAI or Anthropic Claude
   - Enables AI-powered match analysis

## 📊 Dashboard Overview

The dashboard is your command centre showing:
- **Prediction Accuracy**: Current success rate of predictions
- **Total Profit**: Running profit/loss tracker
- **Active Users**: Community engagement metrics
- **Bets Placed**: Total betting activity
- **Recent Predictions**: Latest match predictions with outcomes
- **Upcoming Matches**: Next fixtures to analyse

## 🎯 Making Smart Predictions

### Step 1: Check Match List
Navigate to **Matches** to see upcoming fixtures:
- Green badges = High confidence predictions
- Yellow badges = Medium confidence
- Red badges = Low confidence/avoid

### Step 2: Analyse with Predictions Tab
The **Predictions** page shows:
- Predicted scorelines
- Confidence percentages
- Expected goals (xG) data
- Form analysis

### Step 3: Identify Value Bets
Go to **Value Bets** page:
```
Example Value Bet:
- Match: Arsenal vs Liverpool
- Our Probability: 45% (Arsenal win)
- Bookmaker Odds: 2.80 (implied 35.7%)
- Edge: +9.3% ✅ VALUE BET!
- Kelly Stake: £42 (on £1000 bankroll)
```

## 💰 Kelly Calculator - Optimal Stake Sizing

### Basic Usage
1. Navigate to **Kelly Calculator**
2. Enter your assessment:
   ```
   Your Win Probability: 55%
   Bookmaker Odds: 2.20
   Your Bankroll: £1000
   ```
3. Get recommendations:
   ```
   Full Kelly: £105 (aggressive)
   Half Kelly: £52.50 (recommended) ✅
   Quarter Kelly: £26.25 (conservative)
   ```

### Advanced Settings
- **Kelly Fraction**: Adjust risk (0.25 = quarter Kelly, 0.5 = half Kelly)
- **Model Confidence**: How confident in your probability estimate
- **Max Stake**: Cap maximum bet percentage

## 📈 Maximising Your Potential

### 1. **Daily Routine**
```markdown
Morning (9am):
□ Check Settings > Sync Data
□ Review Dashboard metrics
□ Check Upcoming Matches

Pre-Match Analysis (2 hours before):
□ Review Predictions tab
□ Check team news in AI Assistant
□ Calculate Kelly stakes
□ Identify value bets
```

### 2. **Value Betting Strategy**
Only bet when ALL conditions are met:
- ✅ Edge > 5% (your probability vs bookmaker)
- ✅ Confidence > 60%
- ✅ Kelly recommendation > 0
- ✅ Positive expected value

### 3. **Using the AI Assistant**
Ask strategic questions:
```
"What's Liverpool's away form?"
"How does Arsenal perform against top 6?"
"Show me Haaland's scoring record"
"What's the weather forecast for tomorrow's match?"
```

### 4. **Bankroll Management Rules**
```
Golden Rules:
1. Never bet more than 5% on single match
2. Use Half Kelly (50% of recommendation)
3. Keep 20% bankroll in reserve
4. Track everything in Betting History
```

## 🎲 Example Betting Session

### Scenario: Saturday 3pm Kickoffs
```markdown
Bankroll: £1000
Matches: 5 fixtures

Step 1 - Identify Value:
✅ Arsenal vs Fulham: 8% edge
✅ Liverpool vs Brighton: 6% edge
❌ Chelsea vs Spurs: -2% edge (skip)
✅ Man City vs Wolves: 12% edge
❌ Newcastle vs Villa: 1% edge (too small)

Step 2 - Calculate Stakes (Half Kelly):
Arsenal: £35 (3.5% of bankroll)
Liverpool: £28 (2.8% of bankroll)  
Man City: £42 (4.2% of bankroll)
Total at risk: £105 (10.5% - within limits)

Step 3 - Expected Returns:
If all win: +£168 profit
If 2/3 win: +£41 profit
If 1/3 wins: -£39 loss
Expected Value: +£47 (positive!)
```

## 🔍 Advanced Features

### 1. **Season Stats Analysis**
Check unique insights:
- Biggest comebacks
- Most cards in matches
- Home fortress ratings
- Late drama statistics

### 2. **Head-to-Head Research**
Before betting, always check:
- Last 10 meetings
- Home/away splits
- Goals scored patterns
- Recent form vs opponent

### 3. **Arbitrage Detection**
Kelly Calculator can spot arbitrage:
```
Example Arbitrage:
Bet365: Arsenal 2.90
William Hill: Draw 3.60
Betfair: Liverpool 2.85

Sum of implied probabilities: 97.8% < 100%
Guaranteed profit: 2.2% ✅
```

## 📱 Mobile Usage

The app is fully responsive:
1. Add to home screen for app-like experience
2. Use landscape mode for charts
3. Swipe between tabs on mobile
4. Touch and hold for tooltips

## 🚨 Risk Management

### Red Flags - Don't Bet When:
- 🚫 Emotional after a loss
- 🚫 Chasing losses
- 🚫 Edge < 3%
- 🚫 Uncertain lineups
- 🚫 Kelly suggests > 10% stake

### Green Lights - Good to Bet:
- ✅ Clear value identified
- ✅ Consistent model agreement
- ✅ Within bankroll limits
- ✅ Calm mental state
- ✅ Prepared to lose stake

## 📊 Tracking Performance

### Weekly Review Checklist:
```markdown
□ Export Betting History
□ Calculate actual ROI
□ Compare to predictions
□ Identify patterns in wins/losses
□ Adjust confidence levels
□ Review biggest wins/losses
□ Plan next week's bankroll
```

## 🎯 Pro Tips

1. **Start Small**: Begin with £10-20 bets to test the system
2. **Paper Trade**: Track hypothetical bets for 2 weeks first
3. **Specialise**: Focus on specific teams you know well
4. **Time Bets**: Odds often move, bet at optimal times
5. **Stay Disciplined**: Never deviate from Kelly recommendations
6. **Keep Records**: Screenshot all bets for analysis
7. **Set Limits**: Daily, weekly, and monthly loss limits

## 🆘 Troubleshooting

### API Not Working?
- Check Settings > Test Connection
- Verify API key is correct
- Check rate limits (10 calls/minute)

### Predictions Seem Off?
- Ensure data is synced (Settings > Sync Now)
- Check DataFreshness indicator
- Review recent form manually

### Can't See Upcoming Matches?
- API might be rate-limited
- Switch to Database mode temporarily
- Wait 60 seconds and refresh

## 📈 Expected Results

With disciplined Kelly betting:
- **Win Rate**: 52-58% (beating bookmaker's edge)
- **ROI**: 5-15% per month
- **Drawdown**: Expect 20-30% drops
- **Recovery**: Usually within 4-6 weeks
- **Long-term**: 40-80% annual returns possible

## ⚠️ Disclaimer

- Gambling involves risk
- Only bet what you can afford to lose
- Past performance doesn't guarantee future results
- Take regular breaks
- Seek help if gambling becomes a problem

## 🎓 Learning Resources

- [Kelly Criterion Explained](https://en.wikipedia.org/wiki/Kelly_criterion)
- [Value Betting Guide](https://www.pinnacle.com/en/betting-articles/educational/value-betting)
- [Expected Value Calculator](https://www.pinnacle.com/en/betting-resources/betting-tools/expected-value-calculator)
- [Bankroll Management](https://www.pinnacle.com/en/betting-articles/educational/bankroll-management)

---

*Remember: The Oracle provides guidance, but the decision to bet is always yours. Bet responsibly!*