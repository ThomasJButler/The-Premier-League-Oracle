<script lang="ts">
  import { Book, HelpCircle, TrendingUp, Shield, Zap, ExternalLink, ChevronRight, Home } from 'lucide-svelte';
  import { fade } from 'svelte/transition';
  
  let selectedSection = 'getting-started';
  let showMobileMenu = false;
  
  const sections = [
    { id: 'getting-started', title: 'Getting Started', icon: Home },
    { id: 'predictions', title: 'Understanding Predictions', icon: TrendingUp },
    { id: 'maximizing', title: 'Maximizing Accuracy', icon: Zap },
    { id: 'features', title: 'Features Guide', icon: Book },
    { id: 'security', title: 'Privacy & Security', icon: Shield },
    { id: 'faq', title: 'FAQ', icon: HelpCircle }
  ];
</script>

<div class="min-h-screen bg-background">
  <!-- Header -->
  <div class="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold font-display text-foreground">Help & Documentation</h1>
        <button
          class="sm:hidden p-2 rounded-lg hover:bg-muted"
          on:click={() => showMobileMenu = !showMobileMenu}
          aria-expanded={showMobileMenu}
          aria-controls="help-nav"
          aria-label="Toggle documentation menu"
        >
          <ChevronRight class="w-5 h-5 transition-transform {showMobileMenu ? 'rotate-90' : ''}" />
        </button>
      </div>
    </div>
  </div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <!-- Sidebar Navigation -->
      <nav id="help-nav" class="lg:col-span-1 {showMobileMenu ? 'block' : 'hidden'} sm:block">
        <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4 sticky top-24">
          <h2 class="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
            Documentation
          </h2>
          <ul class="space-y-2">
            {#each sections as section}
              <li>
                <button
                  class="w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-all
                    {selectedSection === section.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted'}"
                  aria-current={selectedSection === section.id ? 'true' : undefined}
                  on:click={() => {
                    selectedSection = section.id;
                    showMobileMenu = false;
                  }}
                >
                  <svelte:component this={section.icon} class="w-4 h-4" />
                  {section.title}
                </button>
              </li>
            {/each}
          </ul>
        </div>
      </nav>

      <!-- Content Area -->
      <div class="lg:col-span-3">
        <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 sm:p-8" in:fade={{ duration: 200 }}>
          {#if selectedSection === 'getting-started'}
            <div class="prose prose-slate dark:prose-invert max-w-none">
              <h2 class="text-xl font-bold mb-6 font-display text-foreground">Getting Started</h2>
              
              <div class="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl mb-8">
                <h3 class="text-xl font-semibold mb-4">Quick Setup Guide</h3>
                <ol class="space-y-4">
                  <li class="flex gap-3">
                    <span class="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">1</span>
                    <div>
                      <strong>Get Your API Key</strong>
                      <p class="text-sm mt-1">Sign up at Football-Data.org for a free API key with 10 requests per minute.</p>
                    </div>
                  </li>
                  <li class="flex gap-3">
                    <span class="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">2</span>
                    <div>
                      <strong>Enter API Key</strong>
                      <p class="text-sm mt-1">Use the setup wizard or go to Settings to add your key.</p>
                    </div>
                  </li>
                  <li class="flex gap-3">
                    <span class="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">3</span>
                    <div>
                      <strong>Start Predicting</strong>
                      <p class="text-sm mt-1">Access live data, predictions, and analytics instantly.</p>
                    </div>
                  </li>
                </ol>
              </div>

              <h3 class="text-xl font-semibold mb-4">Dashboard Overview</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div class="p-4 bg-muted rounded-lg">
                  <h4 class="font-semibold mb-2">📊 Overview Stats</h4>
                  <p class="text-sm">Overall prediction accuracy, recent results, and performance at a glance.</p>
                </div>
                <div class="p-4 bg-muted rounded-lg">
                  <h4 class="font-semibold mb-2">⚽ Upcoming Fixtures</h4>
                  <p class="text-sm">Next matches with model-driven predictions and confidence levels.</p>
                </div>
                <div class="p-4 bg-muted rounded-lg">
                  <h4 class="font-semibold mb-2">📈 Team Stats</h4>
                  <p class="text-sm">Detailed performance metrics including form, home/away splits, and trends.</p>
                </div>
                <div class="p-4 bg-muted rounded-lg">
                  <h4 class="font-semibold mb-2">🎯 Predictions</h4>
                  <p class="text-sm">Five-component ensemble: ELO, Poisson, Form, H2H, and Standings.</p>
                </div>
              </div>

              <a 
                href="https://www.football-data.org/client/register" 
                target="_blank" 
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Get Your API Key <ExternalLink class="w-4 h-4" />
              </a>
            </div>

          {:else if selectedSection === 'predictions'}
            <div class="prose prose-slate dark:prose-invert max-w-none">
              <h2 class="text-xl font-bold mb-6 font-display text-foreground">Understanding Predictions</h2>
              
              <div class="mb-8">
                <h3 class="text-xl font-semibold mb-4">Our Five-Component Ensemble</h3>
                <p class="mb-4 text-muted-foreground">Each component contributes a weighted share to the final prediction. The ensemble combines them to produce more reliable forecasts than any single model alone.</p>

                <div class="space-y-6">
                  <div class="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="font-bold text-lg">🎲 ELO Rating System</h4>
                      <span class="text-sm font-mono bg-blue-100 dark:bg-blue-800 px-2 py-0.5 rounded">25%</span>
                    </div>
                    <p class="mb-3">Dynamic team strength ratings that adjust based on match results and opposition quality.</p>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong class="text-green-600">Best for:</strong>
                        <ul class="mt-1 space-y-1">
                          <li>• Overall team strength</li>
                          <li>• Season-long trends</li>
                          <li>• Head-to-head comparisons</li>
                        </ul>
                      </div>
                      <div>
                        <strong class="text-amber-600">Limitations:</strong>
                        <ul class="mt-1 space-y-1">
                          <li>• Early season volatility</li>
                          <li>• Ignores team news</li>
                          <li>• Slow to adapt</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div class="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="font-bold text-lg">📊 Poisson Distribution</h4>
                      <span class="text-sm font-mono bg-green-100 dark:bg-green-800 px-2 py-0.5 rounded">30%</span>
                    </div>
                    <p class="mb-3">Statistical model that predicts goal probabilities based on team attacking and defensive strengths.</p>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong class="text-green-600">Best for:</strong>
                        <ul class="mt-1 space-y-1">
                          <li>• Exact score predictions</li>
                          <li>• Over/under goals</li>
                          <li>• Both teams to score</li>
                        </ul>
                      </div>
                      <div>
                        <strong class="text-amber-600">Limitations:</strong>
                        <ul class="mt-1 space-y-1">
                          <li>• Assumes independent events</li>
                          <li>• Struggles with extremes</li>
                          <li>• No tactical context</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div class="p-6 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="font-bold text-lg">🔥 Form Analysis</h4>
                      <span class="text-sm font-mono bg-amber-100 dark:bg-amber-800 px-2 py-0.5 rounded">20%</span>
                    </div>
                    <p class="mb-3">Analyses each team's recent results to capture momentum, streaks, and current performance level.</p>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong class="text-green-600">Best for:</strong>
                        <ul class="mt-1 space-y-1">
                          <li>• Recent momentum shifts</li>
                          <li>• Winning/losing streaks</li>
                          <li>• Current confidence levels</li>
                        </ul>
                      </div>
                      <div>
                        <strong class="text-amber-600">Limitations:</strong>
                        <ul class="mt-1 space-y-1">
                          <li>• Small sample size</li>
                          <li>• Doesn't account for fixtures</li>
                          <li>• Can overreact to flukes</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div class="p-6 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="font-bold text-lg">🤝 Head-to-Head</h4>
                      <span class="text-sm font-mono bg-purple-100 dark:bg-purple-800 px-2 py-0.5 rounded">10%</span>
                    </div>
                    <p class="mb-3">Historical record between the two teams — some matchups have persistent patterns that other models miss.</p>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong class="text-green-600">Best for:</strong>
                        <ul class="mt-1 space-y-1">
                          <li>• Derby rivalries</li>
                          <li>• Persistent bogey teams</li>
                          <li>• Ground advantage</li>
                        </ul>
                      </div>
                      <div>
                        <strong class="text-amber-600">Limitations:</strong>
                        <ul class="mt-1 space-y-1">
                          <li>• Squad turnover</li>
                          <li>• Promoted teams have little H2H</li>
                          <li>• Low weight by design</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div class="p-6 bg-gradient-to-r from-slate-50 to-teal-50 dark:from-slate-900/20 dark:to-teal-900/20 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="font-bold text-lg">🏆 League Standings</h4>
                      <span class="text-sm font-mono bg-teal-100 dark:bg-teal-800 px-2 py-0.5 rounded">15%</span>
                    </div>
                    <p class="mb-3">Current league position and points provide a baseline expectation of team quality across the season.</p>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong class="text-green-600">Best for:</strong>
                        <ul class="mt-1 space-y-1">
                          <li>• Season-long context</li>
                          <li>• Mismatches (top vs bottom)</li>
                          <li>• Relegation battles</li>
                        </ul>
                      </div>
                      <div>
                        <strong class="text-amber-600">Limitations:</strong>
                        <ul class="mt-1 space-y-1">
                          <li>• Unreliable early season</li>
                          <li>• Mid-table teams clustered</li>
                          <li>• Doesn't reflect injuries</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-muted p-6 rounded-xl">
                <h3 class="text-lg font-semibold mb-3">Reading Prediction Confidence</h3>
                <div class="space-y-2">
                  <div class="flex items-center gap-3">
                    <div class="w-4 h-4 bg-green-500 rounded-full"></div>
                    <span><strong>High (75%+)</strong> - All models agree strongly</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="w-4 h-4 bg-yellow-500 rounded-full"></div>
                    <span><strong>Medium (60-75%)</strong> - Moderate agreement</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="w-4 h-4 bg-red-500 rounded-full"></div>
                    <span><strong>Low (&lt;60%)</strong> - Models disagree</span>
                  </div>
                </div>
              </div>

              <div class="bg-muted p-6 rounded-xl mt-6">
                <h3 class="text-lg font-semibold mb-3">How the exact scoreline is picked</h3>
                <p class="mb-3 text-muted-foreground">
                  The H/D/A bar (home-win / draw / away-win) comes from the ensemble directly and is calibrated — those percentages are what you should bet on. The exact scoreline below is picked from the Poisson grid via <strong>strict argmax within the predicted outcome</strong>: we look at every cell of the grid consistent with the predicted H/D/A (so all H cells if H is predicted), and display the one with the highest probability.
                </p>
                <p class="mb-3 text-muted-foreground">
                  For typical mid-table fixtures, the modal outcome-consistent cell sits around 9–14% probability — that's honest. Exact-score prediction is inherently noisy because even the single most-likely exact scoreline in any Premier League fixture is usually under 15%. We used to apply rounded-means + H2H tempo nudges to surface more dramatic 3-1 / 3-2 scorelines, but those tweaks produced scorelines that didn't actually appear in the top three most-likely cells of the grid. The v3.5 strict-argmax change restores that invariant.
                </p>
                <p class="text-muted-foreground text-sm">
                  <strong>Practical reading:</strong> trust the H/D/A percentages. The scoreline is "the grid's most plausible exact cell given the outcome" — a useful reference, but don't bet on the exact score unless the probability next to it is high.
                </p>
              </div>

              <div class="bg-muted p-6 rounded-xl mt-6">
                <h3 class="text-lg font-semibold mb-3">The "If forced to pick" line</h3>
                <p class="mb-3 text-muted-foreground">
                  You'll see a small italic line under each prediction card's H/D/A bar reading something like <em>"If forced to pick: 1-0 · 12% chance"</em>. That's intentionally de-emphasised typography because the exact scoreline is a long-odds prediction. The H/D/A bar above it is the headline signal — calibrated, actionable, and what the markets price against. The "if forced to pick" line exists for correct-score fans and as context for bet-builder legs, but it's not the flagship output.
                </p>
              </div>
            </div>

          {:else if selectedSection === 'maximizing'}
            <div class="prose prose-slate dark:prose-invert max-w-none">
              <h2 class="text-xl font-bold mb-6 font-display text-foreground">Maximizing Prediction Accuracy</h2>
              
              <div class="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 rounded-xl mb-8">
                <h3 class="text-xl font-semibold mb-4">🎯 The Golden Rules</h3>
                <ol class="space-y-3">
                  <li><strong>1. Consensus is Key:</strong> When all five models agree, predictions tend to be most reliable — check the Predictions accuracy panel to see how your own results track</li>
                  <li><strong>2. Context Matters:</strong> Always check team news, injuries, and motivation</li>
                  <li><strong>3. Value Over Volume:</strong> Better to skip than force a prediction</li>
                  <li><strong>4. Track Everything:</strong> Learn from both wins and losses</li>
                  <li><strong>5. Stay Disciplined:</strong> Never chase losses or bet emotionally</li>
                </ol>
              </div>

              <h3 class="text-xl font-semibold mb-4">Advanced Strategies</h3>
              
              <div class="grid gap-4 mb-8">
                <div class="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                  <h4 class="font-semibold mb-2">The Fatigue Factor</h4>
                  <p class="text-sm">Teams with congested fixtures (3+ matches in 7 days) can underperform. Our model includes a fatigue component, but always check the schedule yourself.</p>
                </div>

                <div class="p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20">
                  <h4 class="font-semibold mb-2">Fixture Difficulty</h4>
                  <p class="text-sm">Cross-reference model confidence with the opposition's current form and league position. High confidence against a top-6 side deserves more scrutiny than against a relegation candidate.</p>
                </div>

                <div class="p-4 border-l-4 border-teal-500 bg-teal-50 dark:bg-teal-900/20">
                  <h4 class="font-semibold mb-2">Use the Backtest</h4>
                  <p class="text-sm">Run the model backtest on completed matches to see how the prediction engine actually performs — real data beats intuition.</p>
                </div>
              </div>

              <h3 class="text-xl font-semibold mb-4">Kelly Criterion Calculator</h3>
              <div class="p-6 bg-muted rounded-xl">
                <p class="mb-4">The app uses <strong>Half-Kelly</strong> staking — halving the full Kelly recommendation for a safer risk profile:</p>
                <div class="bg-card p-4 rounded-lg font-mono text-sm">
                  Full Kelly = (Probability × Odds - 1) / (Odds - 1)<br/>
                  Recommended Stake = Full Kelly ÷ 2
                </div>
                <p class="text-sm mt-4 text-muted-foreground">Half-Kelly reduces variance significantly while retaining most of the theoretical edge.</p>
              </div>
            </div>

          {:else if selectedSection === 'features'}
            <div class="prose prose-slate dark:prose-invert max-w-none">
              <h2 class="text-xl font-bold mb-6 font-display text-foreground">Features Guide</h2>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">📊 Dashboard</h3>
                  <p class="text-sm mb-3">Your command center for all Premier League data and predictions.</p>
                  <ul class="text-sm space-y-1">
                    <li>• Prediction accuracy stats</li>
                    <li>• Upcoming fixtures</li>
                    <li>• Recent results</li>
                    <li>• Team performance metrics</li>
                  </ul>
                </div>
                
                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">🔮 Predictions</h3>
                  <p class="text-sm mb-3">Advanced statistical models for match outcome predictions.</p>
                  <ul class="text-sm space-y-1">
                    <li>• Five-model ensemble</li>
                    <li>• Confidence ratings</li>
                    <li>• Expected scores</li>
                    <li>• Head-to-head history</li>
                  </ul>
                </div>
                
                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">📈 Kelly Calculator</h3>
                  <p class="text-sm mb-3">Optimize your stake sizes using the Kelly Criterion formula.</p>
                  <ul class="text-sm space-y-1">
                    <li>• Input odds and probability</li>
                    <li>• Get Half-Kelly recommended stake</li>
                    <li>• Auto-suggested bets from predictions</li>
                    <li>• Track placed bets in Betting History</li>
                  </ul>
                </div>
                
                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">💎 Value Scanner</h3>
                  <p class="text-sm mb-3">Identify opportunities where odds exceed true probability.</p>
                  <ul class="text-sm space-y-1">
                    <li>• Automatic value detection</li>
                    <li>• Expected ROI calculation</li>
                    <li>• Risk assessment</li>
                    <li>• Track placed bets</li>
                  </ul>
                </div>
                
                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">🤖 AI Assistant</h3>
                  <p class="text-sm mb-3">Get intelligent insights and explanations for predictions.</p>
                  <ul class="text-sm space-y-1">
                    <li>• Natural language queries</li>
                    <li>• Statistical explanations</li>
                    <li>• Match-specific analysis</li>
                    <li>• Prediction context and reasoning</li>
                  </ul>
                </div>
                
                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">📱 Mobile Features</h3>
                  <p class="text-sm mb-3">Full functionality on all devices with responsive design.</p>
                  <ul class="text-sm space-y-1">
                    <li>• Bottom navigation bar</li>
                    <li>• Touch-optimised controls</li>
                    <li>• IndexedDB data caching</li>
                    <li>• Responsive layouts</li>
                  </ul>
                </div>
              </div>

              <h3 class="text-xl font-semibold mb-4 mt-8">Recent additions (v3.5 / P12–P15)</h3>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">🧮 Accumulators</h3>
                  <p class="text-sm mb-3">Build multi-leg accumulator bets from predicted outcomes. The upcoming <strong>Safe Builder / Risky Builder / Favourites Accumulator</strong> strip auto-generates three preset slips from the current gameweek's predictions on load — you can tweak or save them, or keep using the per-match suggested combos below.</p>
                </div>

                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">📜 Historical Context card</h3>
                  <p class="text-sm mb-3">Flipping a Predictions card reveals five historical rows drawn from the 33-season stats pack: home venue record, away venue record, H2H fixture profile, referee style, and matchday tempo. Rows skip gracefully if a team is newly promoted with no prior data.</p>
                </div>

                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">📅 Multi-year Season Stats</h3>
                  <p class="text-sm mb-3">The Season Stats page has a year-filter dropdown with the last 5 seasons plus the current one. Historical seasons pull from pre-computed stats-pack data (with COVID 2020/21 flagged as anomalous); the current season uses live match data.</p>
                </div>

                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">📈 Season Timeline polish</h3>
                  <p class="text-sm mb-3">Chart tooltips now show team + matchday + points + goal difference + position. Threshold reference lines (40-pt safety, 86-pt title floor) fade in once the race has shape (after matchday 10 or 50% of threshold hit), rather than stretching the y-axis empty early-season.</p>
                </div>

                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">💬 Oracle Chat historical queries</h3>
                  <p class="text-sm mb-3">Ask match-level questions — "Liverpool's away wins in 2023/24", "last five meetings between Arsenal and Chelsea", "2020/21 season summary". The chat now grounds answers in the full 33-season archive via bundled match data, so answers work in production without a running backend.</p>
                </div>

                <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
                  <h3 class="font-bold text-lg mb-3">🎯 Scoreline honesty (v3.5)</h3>
                  <p class="text-sm mb-3">Predicted scorelines are now strict argmax over the grid's outcome-consistent cells — no rounded-means, no H2H tempo nudges. The trade-off: fewer dramatic 3-1 / 3-2 predictions, but every shown scoreline genuinely lives near the peak of the grid. See "How the exact scoreline is picked" under Understanding Predictions.</p>
                </div>
              </div>
            </div>

          {:else if selectedSection === 'security'}
            <div class="prose prose-slate dark:prose-invert max-w-none">
              <h2 class="text-xl font-bold mb-6 font-display text-foreground">Privacy & Security</h2>
              
              <div class="bg-green-50 dark:bg-green-900/20 p-6 rounded-xl mb-8">
                <h3 class="text-xl font-semibold mb-4">🔒 Your Data is Safe</h3>
                <p class="mb-4">We take your privacy seriously. Here's how we protect your information:</p>
                <ul class="space-y-2">
                  <li class="flex items-start gap-3">
                    <Shield class="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <strong>Local Storage Only</strong>
                      <p class="text-sm">Your API key is stored locally in your browser, never on our servers.</p>
                    </div>
                  </li>
                  <li class="flex items-start gap-3">
                    <Shield class="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <strong>No Data Collection</strong>
                      <p class="text-sm">We don't track, store, or analyze your personal data or usage patterns.</p>
                    </div>
                  </li>
                  <li class="flex items-start gap-3">
                    <Shield class="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <strong>Direct API Calls</strong>
                      <p class="text-sm">Football data comes directly from Football-Data.org. The AI Assistant uses a server-side proxy to keep your Anthropic key out of the browser.</p>
                    </div>
                  </li>
                  <li class="flex items-start gap-3">
                    <Shield class="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <strong>Open Source</strong>
                      <p class="text-sm">Our code is publicly available for security audits and transparency.</p>
                    </div>
                  </li>
                </ul>
              </div>

              <h3 class="text-xl font-semibold mb-4">API Key Security</h3>
              <div class="p-6 bg-muted rounded-xl">
                <h4 class="font-semibold mb-3">Best Practices:</h4>
                <ul class="space-y-2 text-sm">
                  <li>✅ Use a dedicated API key for this app</li>
                  <li>✅ Rotate keys periodically</li>
                  <li>✅ Never share your API key</li>
                  <li>✅ Monitor usage in Football-Data.org dashboard</li>
                  <li>✅ Report any suspicious activity immediately</li>
                </ul>
              </div>
            </div>

          {:else if selectedSection === 'faq'}
            <div class="prose prose-slate dark:prose-invert max-w-none">
              <h2 class="text-xl font-bold mb-6 font-display text-foreground">Frequently Asked Questions</h2>
              
              <div class="space-y-6">
                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">How do the predictions work?</h3>
                  <p>The Oracle uses a five-component ensemble model that combines ELO ratings (25%), Poisson distribution (30%), recent form (20%), head-to-head records (10%), and league standings (15%). Each model independently predicts match probabilities, and the ensemble weights them to produce a final forecast. When the optional ML backend is connected, a trained XGBoost model blends in for additional accuracy.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">How accurate are the predictions?</h3>
                  <p>Accuracy varies by confidence level — high-confidence predictions (75%+) where all five models agree tend to be the most reliable. The frontend ensemble is calibrated against historical Premier League data going back to 2020. You can track your own accuracy over time in the Predictions view, which records how each prediction performed once the match completes.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">Is this app free to use?</h3>
                  <p>Yes! The app is completely free. You just need an API key from <a href="https://www.football-data.org/" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Football-Data.org</a>, which provides 10 requests per minute on the free tier. Register for an account and copy your API key into Settings.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">Why am I seeing "Rate Limit Exceeded" errors?</h3>
                  <p>The free API tier allows 10 requests per minute. The app queues requests to stay within this limit, but if you navigate rapidly between pages it can occasionally exceed the threshold. Wait 60 seconds and the queue will clear automatically.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">Can I use this for betting?</h3>
                  <p>The app includes a Kelly Criterion calculator and value bet detection engine for research purposes. The betting tools identify mathematically favourable situations based on the model's probabilities. However, any betting decisions are your own responsibility. Always gamble responsibly and within your means.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">How often is data updated?</h3>
                  <p>Match data uses adaptive polling: every 30 seconds during live matches, every 5 minutes on matchdays, and every 30 minutes otherwise. Data is cached locally in a three-tier system (memory, IndexedDB, then API) to minimise API calls and ensure fast loading.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">What is the ML backend?</h3>
                  <p>The optional Python backend runs a trained XGBoost model with 99 features including ELO differentials, draw indicators, and rolling form metrics. Enable it in Settings to blend machine learning predictions with the frontend ensemble. The backend also powers the Oracle Chat for natural language match queries.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">Can I customise the look and feel?</h3>
                  <p>Yes — Settings lets you toggle dark/light mode and pick a favourite team. Choosing a team applies that club's colours throughout the interface. There are themes for all 20 current Premier League sides.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">Does it work offline?</h3>
                  <p>The app caches recent data in your browser (IndexedDB) to reduce API calls and improve loading speed, but requires an internet connection for live updates and new predictions. Previously viewed data remains available even when offline.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">Why are predicted scorelines usually 1-0, 2-1, or 0-1?</h3>
                  <p>Because the Poisson grid for typical Premier League fixtures concentrates probability on low-scoring outcomes — even the single most-likely scoreline in the league sits around 10–14% probability. The shown scoreline is the grid's <strong>most-likely outcome-consistent cell</strong>, which for mid-table fixtures means 1-0 or 0-1. The Top-3 Most Likely Scorelines strip on the card back shows the spread. Blowout fixtures (Arsenal vs Burnley etc.) surface 2-0 / 3-0 naturally because the grid's modal H-cell shifts accordingly.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">Why are draws rarely the headline prediction?</h3>
                  <p>Draws are genuinely the minority outcome in the Premier League (~25% of matches), and the strict-argmax approach picks the single most-likely cell for the ensemble's H/D/A choice. When H/D/A confidence tips ≥35% home-win but P(1-1 draw) is only 13% versus P(1-0 home-win) at 14%, the model shows 1-0 even though the draw aggregate is close. The H/D/A bar still shows draws at realistic 20–27% rates; only the modal-cell display prefers the winning side. This is a known trade-off between "honest modal scoreline" and "surface draws more often" — see the backend calibration note in the v3 ML model section of the main plan.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">Does the Oracle have all 33 seasons of data?</h3>
                  <p>Yes — the frontend bundles a compact match index covering 1993/94 to the current season (~12,500 matches). When you ask Oracle Chat a specific historical question like "Liverpool's away wins in 2023/24" or "last five meetings between Arsenal and Chelsea", the chat detects the pattern, pulls the matching rows from the bundled index, and grounds the answer in those real results. This works in production without any backend running.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">Where is my data stored?</h3>
                  <p>Everything is stored locally in your browser — predictions, bets, ELO ratings, settings, and cached match data all live in localStorage and IndexedDB. Nothing is sent to external servers. Clearing your browser data will reset everything.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">Can I export my data?</h3>
                  <p>Yes — the Betting History page has a JSON export button for your tracked bets. Prediction history is also stored locally and could be exported via browser developer tools if needed.</p>
                </div>

                <div class="p-6 bg-muted rounded-xl">
                  <h3 class="font-semibold text-lg mb-2">Will you add other leagues?</h3>
                  <p>The app is focused exclusively on the English Premier League. The prediction models are specifically calibrated for PL characteristics (home advantage rates, draw frequencies, scoring patterns). There are no current plans to add other leagues.</p>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

