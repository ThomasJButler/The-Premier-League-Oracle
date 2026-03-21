<script lang="ts">
  import { Settings as SettingsIcon, Database, RefreshCw, CheckCircle, AlertCircle, Wifi, Trophy, Heart, Cpu, Sparkles, Bot } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { footballDataAPI } from '../services/api/footballData';
  import { dataService } from '../services/dataService';
  import { backendService } from '../services/backendService';
  import { aiAnalysisService } from '../services/aiAnalysis';
  import { AI_MODELS, DEFAULT_AI_MODEL, AI_MODEL_STORAGE_KEY } from '$lib/constants';
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // API Key
  let footballDataKey = '';
  
  // Status
  let apiConnected = false;
  let verifying = false;
  let testing = false;
  let testResult: { success: boolean; message: string } | null = null;
  let isRefreshing = false;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (refreshTimer) clearTimeout(refreshTimer);
  });

  // Favourite team
  let favouriteTeam = '';
  let plTeams: string[] = [];

  // Team brand colours for the favourite-team picker.
  // Keys MUST match [data-team="..."] selectors in app.css.
  // SEASONAL UPDATE: add promoted teams, remove relegated, update app.css too.
  const teamColors: Record<string, string> = {
    'Arsenal': '#EF0107', 'Aston Villa': '#670E36', 'Bournemouth': '#DA020E',
    'Brentford': '#FF0000', 'Brighton': '#0057B8', 'Chelsea': '#034694',
    'Crystal Palace': '#1B458F', 'Everton': '#003399', 'Fulham': '#000000',
    'Ipswich Town': '#0000FF', 'Leicester City': '#003090', 'Liverpool': '#C8102E',
    'Manchester City': '#6CABDD', 'Manchester United': '#DA020E',
    'Newcastle United': '#241F20', 'Nottingham Forest': '#DD0000',
    'Southampton': '#D71920', 'Tottenham': '#132257',
    'West Ham United': '#7A263A', 'Wolverhampton': '#FDB913'
  };

  function setFavouriteTeam(team: string) {
    favouriteTeam = team;
    if (team) {
      localStorage.setItem('favourite_team', team);
      document.documentElement.dataset.team = team;
    } else {
      localStorage.removeItem('favourite_team');
      delete document.documentElement.dataset.team;
    }
  }

  // AI Analysis
  let aiAnalysisEnabled = false;
  let aiKeyAvailable: boolean | null = null;
  let selectedAiModel = DEFAULT_AI_MODEL;
  let aiApiKey = '';
  let aiApiKeyEditing = false; // true when user wants to change/enter a new key

  function detectProvider(key: string): string | null {
    if (key.startsWith('sk-ant-')) return 'Anthropic';
    if (key.startsWith('sk-')) return 'OpenAI';
    return null;
  }

  function saveAiApiKey() {
    const trimmed = aiApiKey.trim();
    if (!trimmed || trimmed.length < 10) return;
    localStorage.setItem('openai_api_key', trimmed);
    aiKeyAvailable = true;
    aiApiKeyEditing = false;
    window.dispatchEvent(new CustomEvent('api-key-changed'));
  }

  function clearAiApiKey() {
    localStorage.removeItem('openai_api_key');
    aiApiKey = '';
    aiKeyAvailable = false;
    aiApiKeyEditing = false;
    localStorage.removeItem('ai_analysis_server_key');
    window.dispatchEvent(new CustomEvent('api-key-changed'));
    // Re-check for server key
    checkAiKeyStatus();
  }

  function startEditingAiKey() {
    aiApiKeyEditing = true;
    aiApiKey = '';
  }

  function handleAiKeyKeydown(e: Event) {
    if ((e as KeyboardEvent).key === 'Enter') saveAiApiKey();
  }

  async function checkAiKeyStatus() {
    aiKeyAvailable = null;
    aiKeyAvailable = await aiAnalysisService.hasApiKey();
  }

  function saveAiModel(model: string) {
    selectedAiModel = model;
    localStorage.setItem(AI_MODEL_STORAGE_KEY, model);
  }

  function toggleAiAnalysis() {
    aiAnalysisEnabled = !aiAnalysisEnabled;
    aiAnalysisService.setEnabled(aiAnalysisEnabled);
  }

  function clearAiCache() {
    aiAnalysisService.clearCache();
    testResult = {
      success: true,
      message: 'AI analysis cache cleared'
    };
  }

  // ML Backend
  let useBackend = false;
  let backendAvailable: boolean | null = null; // null = not checked yet
  let checkingBackend = false;
  let oracleApiToken = '';

  function toggleBackend() {
    useBackend = !useBackend;
    localStorage.setItem('use_backend', useBackend ? 'true' : 'false');
    backendService.invalidateCache();
    if (useBackend) {
      checkBackendStatus();
    } else {
      backendAvailable = null;
    }
  }

  async function checkBackendStatus() {
    checkingBackend = true;
    backendService.invalidateCache();
    try {
      backendAvailable = await backendService.isAvailable();
    } catch {
      backendAvailable = false;
    } finally {
      checkingBackend = false;
    }
  }

  function saveOracleToken() {
    const trimmed = oracleApiToken.trim();
    if (trimmed) {
      localStorage.setItem('oracle_api_token', trimmed);
    } else {
      localStorage.removeItem('oracle_api_token');
    }
    backendService.invalidateCache();
    if (useBackend) {
      checkBackendStatus();
    }
  }

  // Cache management
  let cacheSize = '0 MB';
  let lastSync = 'Never';
  
  async function testConnection() {
    testing = true;
    testResult = null;
    
    try {
      const isConnected = await footballDataAPI.testConnection();
      
      if (isConnected) {
        testResult = {
          success: true,
          message: `Successfully connected! Refreshing data in 5 seconds...`
        };
        apiConnected = true;
        isRefreshing = true;

        // Clear stale cache and refresh data services with the new key
        refreshTimer = setTimeout(async () => {
          await dataService.clearCache();
          await dataService.refreshApiConfiguration();
          dispatch('apiConfigured');
          isRefreshing = false;
        }, 5000);
      } else {
        testResult = {
          success: false,
          message: 'Failed to connect. Please check your API key.'
        };
        apiConnected = false;
      }
    } catch (error) {
      testResult = {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      apiConnected = false;
    } finally {
      testing = false;
    }
  }
  
  function saveFootballDataKey() {
    const trimmedKey = footballDataKey.trim();
    if (trimmedKey) {
      footballDataAPI.setApiKey(trimmedKey);
      testConnection();
    }
  }
  
  
  async function clearCache() {
    await dataService.clearCache();
    cacheSize = '0 MB';
    testResult = {
      success: true,
      message: 'Cache cleared successfully'
    };
  }
  
  async function syncData() {
    testing = true;
    try {
      await dataService.getMatches({ recent: true, days: 30 });
      lastSync = new Date().toLocaleString('en-GB');
      localStorage.setItem('last_sync', lastSync);
      testResult = {
        success: true,
        message: 'Data synchronised successfully'
      };
    } catch (error) {
      testResult = {
        success: false,
        message: 'Sync failed. Please try again.'
      };
    } finally {
      testing = false;
    }
  }
  
  onMount(async () => {
    // Populate team list immediately — these names match the CSS
    // [data-team="..."] selectors in app.css. Update on promotion/relegation.
    plTeams = Object.keys(teamColors).sort();

    // Load saved settings
    const savedFootballDataKey = localStorage.getItem('football_data_api_key');
    
    if (savedFootballDataKey) {
      footballDataKey = savedFootballDataKey;
      footballDataAPI.setApiKey(savedFootballDataKey);
      // Verify the saved key with a real API ping
      verifying = true;
      footballDataAPI.testConnection().then(ok => {
        apiConnected = ok;
        verifying = false;
      }).catch(() => {
        apiConnected = false;
        verifying = false;
      });
    }
    
    // Load last sync time
    const savedLastSync = localStorage.getItem('last_sync');
    if (savedLastSync) {
      lastSync = savedLastSync;
    }
    
    // Load favourite team — restore both local state and DOM attribute
    const savedTeam = localStorage.getItem('favourite_team');
    if (savedTeam) {
      favouriteTeam = savedTeam;
      document.documentElement.dataset.team = savedTeam;
    }

    // Load AI model preference
    selectedAiModel = localStorage.getItem(AI_MODEL_STORAGE_KEY) || DEFAULT_AI_MODEL;

    // Load AI analysis settings
    aiAnalysisEnabled = aiAnalysisService.isEnabled();
    const savedAiKey = localStorage.getItem('openai_api_key');
    if (savedAiKey) {
      aiApiKey = savedAiKey;
    }
    aiAnalysisService.hasApiKey().then(available => {
      aiKeyAvailable = available;
    }).catch(() => {
      aiKeyAvailable = false;
    });

    // Load ML backend settings
    useBackend = localStorage.getItem('use_backend') === 'true';
    const savedToken = localStorage.getItem('oracle_api_token');
    if (savedToken) {
      oracleApiToken = savedToken;
    }
    if (useBackend) {
      checkBackendStatus();
    }

    // Estimate total storage usage (IndexedDB + localStorage + Cache API)
    if (navigator.storage?.estimate) {
      try {
        const { usage } = await navigator.storage.estimate();
        if (usage) {
          const totalMB = usage / (1024 * 1024);
          cacheSize = totalMB < 0.01 ? '< 0.01 MB' : `${totalMB.toFixed(2)} MB`;
        }
      } catch {
        cacheSize = 'Unknown';
      }
    } else {
      // Fallback: measure localStorage only (older browsers)
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) totalBytes += key.length + (localStorage.getItem(key)?.length ?? 0);
      }
      const totalMB = (totalBytes * 2) / (1024 * 1024);
      cacheSize = totalMB < 0.01 ? '< 0.01 MB' : `${totalMB.toFixed(2)} MB`;
    }

  });
</script>

<div class="settings-container max-w-4xl mx-auto">
  <!-- Header -->
  <div class="rounded-xl border border-border bg-muted p-6 mb-6">
    <div class="flex items-center space-x-3">
      <div class="p-3 bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg">
        <SettingsIcon class="w-8 h-8 text-white" />
      </div>
      <div>
        <h1 class="text-2xl font-bold font-display text-foreground">Settings</h1>
        <p class="text-sm text-muted-foreground">
          Configure your API provider and manage data
        </p>
      </div>
    </div>
  </div>
  
  <!-- Football-Data.org API Configuration -->
  <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 mb-6">
    <h2 class="text-lg font-bold font-display text-foreground mb-4">Football-Data.org API Configuration</h2>
    
    <div class="max-w-2xl">
      <!-- Football-Data.org -->
      <div class="border-2 rounded-xl p-6 border-primary bg-primary/5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-2">
            <Trophy class="w-6 h-6 text-green-600" />
            <h3 class="font-bold text-lg">Football-Data.org</h3>
          </div>
          <span class="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
            FREE
          </span>
        </div>
        
        <p class="text-sm text-muted-foreground mb-4">
          Perfect for testing and demos. Premier League data with 10 requests per minute.
        </p>
        
        <div class="space-y-3">
          <div>
            <label for="football-data-key" class="block text-sm font-medium text-foreground mb-1">
              API Key
            </label>
            <div class="flex space-x-2">
              <input
                id="football-data-key"
                type="password"
                bind:value={footballDataKey}
                placeholder="Enter your Football-Data.org key"
                class="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-muted"
              />
              <Button
                on:click={saveFootballDataKey}
                disabled={!footballDataKey.trim() || testing}
                size="sm"
              >
                {#if testing}
                  <RefreshCw class="w-4 h-4 animate-spin" />
                {:else}
                  Connect
                {/if}
              </Button>
            </div>
          </div>
          
          <a 
            href="https://www.football-data.org/client/register" 
            target="_blank" 
            class="inline-flex items-center text-xs text-primary hover:underline"
          >
            Get free API key →
          </a>
        </div>
      </div>
    </div>
    
    <!-- Status Messages -->
    {#if testResult}
      <div 
        class="mt-6 p-3 rounded-lg flex items-center space-x-2 {
          testResult.success 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
        }"
        transition:fade
      >
        {#if testResult.success}
          {#if isRefreshing}
            <RefreshCw class="w-5 h-5 animate-spin" />
          {:else}
            <CheckCircle class="w-5 h-5" />
          {/if}
        {:else}
          <AlertCircle class="w-5 h-5" />
        {/if}
        <span class="text-sm">{testResult.message}</span>
      </div>
    {/if}
    
    <!-- API Status -->
    <div class="mt-6 p-4 bg-muted rounded-lg">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-foreground">API Status</p>
          <p class="text-xs text-muted-foreground mt-1">
            Football-Data.org - Premier League Data
          </p>
        </div>
        <div class="flex items-center space-x-2">
          {#if verifying}
            <span class="flex items-center space-x-1 text-amber-600 dark:text-amber-400 text-sm">
              <RefreshCw class="w-4 h-4 animate-spin" />
              <span>Verifying…</span>
            </span>
          {:else if apiConnected}
            <span class="flex items-center space-x-1 text-green-600 dark:text-green-400 text-sm">
              <Wifi class="w-4 h-4" />
              <span>Connected</span>
            </span>
          {:else}
            <span class="flex items-center space-x-1 text-muted-foreground text-sm">
              <Wifi class="w-4 h-4" />
              <span>Not Connected</span>
            </span>
          {/if}
        </div>
      </div>
    </div>
  </div>
  
  <!-- Favourite Team -->
  <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 mb-6">
    <h2 class="text-lg font-bold font-display text-foreground flex items-center space-x-2 mb-4">
      <Heart class="w-5 h-5 text-primary" />
      <span>Favourite Team</span>
    </h2>
    <p class="text-sm text-muted-foreground mb-4">
      Pick your club and the app's accent colours will match their home shirt.
    </p>

    <div class="flex items-center gap-3">
      {#if favouriteTeam && teamColors[favouriteTeam]}
        <div
          class="w-5 h-5 rounded-full border border-border flex-shrink-0"
          style="background-color: {teamColors[favouriteTeam]};"
        ></div>
      {/if}
      <select
        id="favourite-team"
        aria-label="Favourite team"
        bind:value={favouriteTeam}
        on:change={() => setFavouriteTeam(favouriteTeam)}
        class="flex-1 max-w-xs px-3 py-2.5 text-sm rounded-lg border border-border bg-muted text-foreground"
      >
        <option value="">None (PL Default)</option>
        {#each plTeams as team}
          <option value={team}>{team}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- ML Backend -->
  <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 mb-6">
    <h2 class="text-lg font-bold font-display text-foreground flex items-center space-x-2 mb-4">
      <Cpu class="w-5 h-5 text-primary" />
      <span>ML Backend</span>
    </h2>
    <p class="text-sm text-muted-foreground mb-4">
      Connect to the Python ML backend for enhanced predictions using XGBoost, LSTM, and Transformer models. When disabled, predictions use the built-in TypeScript ensemble.
    </p>

    <!-- Toggle -->
    <div class="flex items-center justify-between p-3 bg-muted rounded-lg mb-4">
      <div>
        <p class="text-sm font-medium text-foreground">Use ML Backend</p>
        <p class="text-xs text-muted-foreground">Route predictions through the Python backend when available</p>
      </div>
      <button
        on:click={toggleBackend}
        class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {useBackend ? 'bg-primary' : 'bg-muted-foreground/30'}"
        role="switch"
        aria-checked={useBackend}
        aria-label="Use ML backend"
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {useBackend ? 'translate-x-6' : 'translate-x-1'}"
        ></span>
      </button>
    </div>

    {#if useBackend}
      <!-- Connection Status -->
      <div class="flex items-center justify-between p-3 bg-muted rounded-lg mb-4" transition:fade>
        <div>
          <p class="text-sm font-medium text-foreground">Backend Status</p>
          <p class="text-xs text-muted-foreground">
            {#if checkingBackend}
              Checking connection…
            {:else if backendAvailable === true}
              Connected and healthy
            {:else if backendAvailable === false}
              Unreachable — predictions will use TypeScript ensemble
            {:else}
              Not checked yet
            {/if}
          </p>
        </div>
        <div class="flex items-center space-x-2">
          {#if checkingBackend}
            <RefreshCw class="w-4 h-4 animate-spin text-amber-500" />
          {:else if backendAvailable === true}
            <span class="w-3 h-3 rounded-full bg-green-500"></span>
          {:else if backendAvailable === false}
            <span class="w-3 h-3 rounded-full bg-red-500"></span>
          {:else}
            <span class="w-3 h-3 rounded-full bg-muted-foreground/30"></span>
          {/if}
          <Button
            on:click={checkBackendStatus}
            disabled={checkingBackend}
            variant="secondary"
            size="sm"
          >
            Test
          </Button>
        </div>
      </div>

      <!-- API Token -->
      <div class="p-3 bg-muted rounded-lg" transition:fade>
        <label for="oracle-api-token" class="block text-sm font-medium text-foreground mb-1">
          API Token <span class="text-xs text-muted-foreground font-normal">(optional)</span>
        </label>
        <div class="flex space-x-2">
          <input
            id="oracle-api-token"
            type="password"
            bind:value={oracleApiToken}
            placeholder="Bearer token for authenticated endpoints"
            class="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-muted"
          />
          <Button
            on:click={saveOracleToken}
            variant="secondary"
            size="sm"
          >
            Save
          </Button>
        </div>
        <p class="text-xs text-muted-foreground mt-1">
          Only needed if your backend requires authentication.
        </p>
      </div>
    {/if}
  </div>

  <!-- AI Match Analysis -->
  <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 mb-6">
    <h2 class="text-lg font-bold font-display text-foreground flex items-center space-x-2 mb-4">
      <Sparkles class="w-5 h-5 text-primary" />
      <span>AI Match Analysis</span>
    </h2>
    <p class="text-sm text-muted-foreground mb-4">
      Add AI-powered qualitative analysis to match predictions. Supports OpenAI and Anthropic (Claude). Analyses are cached for 24 hours per match.
    </p>

    <!-- Toggle -->
    <div class="flex items-center justify-between p-3 bg-muted rounded-lg mb-4">
      <div>
        <p class="text-sm font-medium text-foreground">Enable AI Analysis</p>
        <p class="text-xs text-muted-foreground">Show AI-generated match narratives on prediction cards</p>
      </div>
      <button
        on:click={toggleAiAnalysis}
        class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {aiAnalysisEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}"
        role="switch"
        aria-checked={aiAnalysisEnabled}
        aria-label="Enable AI match analysis"
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {aiAnalysisEnabled ? 'translate-x-6' : 'translate-x-1'}"
        ></span>
      </button>
    </div>

    {#if aiAnalysisEnabled}
      <!-- AI API Key -->
      <div class="p-3 bg-muted rounded-lg mb-4" transition:fade>
        <p class="text-sm font-medium text-foreground mb-2">AI API Key</p>
        {#if aiApiKey && !aiApiKeyEditing}
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-green-500"></span>
              <span class="text-sm text-foreground">
                {detectProvider(aiApiKey) ?? 'API'} key configured
              </span>
              <span class="text-xs text-muted-foreground font-mono">
                (•••{aiApiKey.slice(-4)})
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Button on:click={startEditingAiKey} variant="secondary" size="sm">
                Change
              </Button>
              <Button on:click={clearAiApiKey} variant="ghost" size="sm">
                Remove
              </Button>
            </div>
          </div>
        {:else}
          <div class="flex gap-2">
            <input
              type="password"
              bind:value={aiApiKey}
              placeholder="sk-... or sk-ant-..."
              class="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground"
              on:keydown={handleAiKeyKeydown}
            />
            <Button on:click={saveAiApiKey} size="sm">
              Save
            </Button>
            {#if aiApiKeyEditing}
              <Button on:click={() => { aiApiKeyEditing = false; aiApiKey = localStorage.getItem('openai_api_key') || ''; }} variant="ghost" size="sm">
                Cancel
              </Button>
            {/if}
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            Get a key from <a href="https://platform.openai.com/api-keys" target="_blank" class="text-primary hover:underline">OpenAI</a>
            or <a href="https://console.anthropic.com/settings/keys" target="_blank" class="text-primary hover:underline">Anthropic</a>.
            Used for Oracle Chat and AI match analysis. Stored in your browser only.
          </p>
        {/if}
      </div>

      <!-- API Key Status -->
      <div class="flex items-center justify-between p-3 bg-muted rounded-lg mb-4" transition:fade>
        <div>
          <p class="text-sm font-medium text-foreground">API Key Status</p>
          <p class="text-xs text-muted-foreground">
            {#if aiKeyAvailable === null}
              Checking…
            {:else if aiKeyAvailable}
              Ready — using {aiApiKey ? `your ${detectProvider(aiApiKey) ?? ''} key`.trim() : 'server-side key'}
            {:else}
              No key — add one above or ask the site owner to set OPENAI_API_KEY / ANTHROPIC_API_KEY
            {/if}
          </p>
        </div>
        <div class="flex items-center space-x-2">
          {#if aiKeyAvailable === null}
            <RefreshCw class="w-4 h-4 animate-spin text-amber-500" />
          {:else if aiKeyAvailable}
            <span class="w-3 h-3 rounded-full bg-green-500"></span>
          {:else}
            <span class="w-3 h-3 rounded-full bg-red-500"></span>
          {/if}
        </div>
      </div>

      <!-- Clear AI Cache -->
      <div class="flex items-center justify-between p-3 bg-muted rounded-lg" transition:fade>
        <div>
          <p class="text-sm font-medium text-foreground">Analysis Cache</p>
          <p class="text-xs text-muted-foreground">Clear cached analyses to fetch fresh ones</p>
        </div>
        <Button
          on:click={clearAiCache}
          variant="secondary"
          size="sm"
        >
          Clear
        </Button>
      </div>
    {/if}
  </div>

  <!-- AI Model Selection -->
  <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 mb-6">
    <h2 class="text-lg font-bold font-display text-foreground flex items-center space-x-2 mb-4">
      <Bot class="w-5 h-5 text-primary" />
      <span>AI Model</span>
    </h2>
    <p class="text-sm text-muted-foreground mb-4">
      Choose which model powers Oracle Chat and AI Match Analysis.
      Supports OpenAI (GPT) and Anthropic (Claude). Larger models
      produce richer analysis but cost more per request.
    </p>

    <div class="flex items-center gap-3">
      <select
        id="ai-model"
        aria-label="AI model"
        bind:value={selectedAiModel}
        on:change={() => saveAiModel(selectedAiModel)}
        class="flex-1 max-w-md px-3 py-2.5 text-sm rounded-lg border border-border bg-muted text-foreground"
      >
        {#each AI_MODELS as model}
          <option value={model.id}>{model.label}</option>
        {/each}
      </select>
    </div>

    <p class="text-xs text-muted-foreground mt-3">
      The server can override this via the <code class="text-xs bg-muted px-1 py-0.5 rounded">ORACLE_AI_MODEL</code> environment variable.
    </p>
  </div>

  <!-- Cache Management -->
  <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
    <h2 class="text-lg font-bold font-display text-foreground flex items-center space-x-2 mb-4">
      <Database class="w-5 h-5 text-primary" />
      <span>Data Management</span>
    </h2>
    
    <div class="space-y-4">
      <div class="flex items-center justify-between p-3 bg-muted rounded-lg">
        <div>
          <p class="text-sm font-medium text-foreground">Cache Size</p>
          <p class="text-xs text-muted-foreground">{cacheSize}</p>
        </div>
        <Button
          on:click={clearCache}
          variant="secondary"
          size="sm"
        >
          Clear Cache
        </Button>
      </div>
      
      <div class="flex items-center justify-between p-3 bg-muted rounded-lg">
        <div>
          <p class="text-sm font-medium text-foreground">Last Sync</p>
          <p class="text-xs text-muted-foreground">{lastSync}</p>
        </div>
        <Button
          on:click={syncData}
          disabled={testing}
          size="sm"
        >
          {#if testing}
            <RefreshCw class="w-4 h-4 animate-spin" />
          {:else}
            Sync Now
          {/if}
        </Button>
      </div>
    </div>
  </div>
</div>
