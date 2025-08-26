<script lang="ts">
  import { Settings as SettingsIcon, Key, Database, RefreshCw, CheckCircle, AlertCircle, Wifi, Trophy, Sparkles } from 'lucide-svelte';
  import { footballDataAPI } from '../services/api/footballData';
  import { dataService } from '../services/dataService';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  // API Key
  let footballDataKey = '';
  
  // Status
  let apiConnected = false;
  let testing = false;
  let testResult: { success: boolean; message: string } | null = null;
  let isRefreshing = false;
  
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
          message: `Successfully connected! Refreshing dashboard in 5 seconds...`
        };
        apiConnected = true;
        isRefreshing = true;
        
        // API is connected
        
        // Add 5-second delay before refresh
        setTimeout(async () => {
          // Clear cache to force fresh data
          await dataService.clearCache();
          
          // Trigger dashboard refresh
          dispatch('apiConfigured');
          
          // Force page reload after a brief delay to ensure all components refresh
          setTimeout(() => {
            window.location.reload();
          }, 500);
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
    if (footballDataKey.trim()) {
      footballDataAPI.setApiKey(footballDataKey);
      localStorage.setItem('football_data_api_key', footballDataKey);
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
  
  onMount(() => {
    // Load saved settings
    const savedFootballDataKey = localStorage.getItem('football_data_api_key');
    
    if (savedFootballDataKey) {
      footballDataKey = savedFootballDataKey;
      footballDataAPI.setApiKey(savedFootballDataKey);
      apiConnected = true;
    }
    
    // Load last sync time
    const savedLastSync = localStorage.getItem('last_sync');
    if (savedLastSync) {
      lastSync = savedLastSync;
    }
    
    // Check cache size (mock calculation)
    const cacheEntries = localStorage.length;
    cacheSize = `${(cacheEntries * 0.005).toFixed(2)} MB`;
  });
</script>

<div class="settings-container max-w-4xl mx-auto">
  <!-- Header -->
  <div class="bg-gradient-to-r from-slate-500/10 to-slate-600/10 dark:from-slate-500/20 dark:to-slate-600/20 rounded-xl p-6 mb-6">
    <div class="flex items-center space-x-3">
      <div class="p-3 bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg">
        <SettingsIcon class="w-8 h-8 text-white" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Configure your API provider and manage data
        </p>
      </div>
    </div>
  </div>
  
  <!-- API Provider Selection -->
  <div class="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6 mb-6">
    <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-4">Football-Data.org API Configuration</h2>
    
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
        
        <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Perfect for testing and demos. Premier League data with 10 requests per minute.
        </p>
        
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              API Key
            </label>
            <div class="flex space-x-2">
              <input
                type="password"
                bind:value={footballDataKey}
                placeholder="Enter your Football-Data.org key"
                class="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                on:click={saveFootballDataKey}
                disabled={!footballDataKey.trim() || testing}
                class="btn btn-sm btn-primary disabled:opacity-50"
              >
                {#if testing}
                  <RefreshCw class="w-4 h-4 animate-spin" />
                {:else}
                  Connect
                {/if}
              </button>
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
    <div class="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-slate-700 dark:text-slate-300">API Status</p>
          <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Football-Data.org - Premier League Data
          </p>
        </div>
        <div class="flex items-center space-x-2">
          {#if apiConnected}
            <span class="flex items-center space-x-1 text-green-600 dark:text-green-400 text-sm">
              <Wifi class="w-4 h-4" />
              <span>Connected</span>
            </span>
          {:else}
            <span class="flex items-center space-x-1 text-slate-500 dark:text-slate-400 text-sm">
              <Wifi class="w-4 h-4" />
              <span>Not Connected</span>
            </span>
          {/if}
        </div>
      </div>
    </div>
  </div>
  
  <!-- Cache Management -->
  <div class="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6">
    <h2 class="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2 mb-4">
      <Database class="w-5 h-5 text-primary" />
      <span>Data Management</span>
    </h2>
    
    <div class="space-y-4">
      <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <div>
          <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Cache Size</p>
          <p class="text-xs text-slate-600 dark:text-slate-400">{cacheSize}</p>
        </div>
        <button
          on:click={clearCache}
          class="btn btn-sm btn-secondary"
        >
          Clear Cache
        </button>
      </div>
      
      <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <div>
          <p class="text-sm font-medium text-slate-700 dark:text-slate-300">Last Sync</p>
          <p class="text-xs text-slate-600 dark:text-slate-400">{lastSync}</p>
        </div>
        <button
          on:click={syncData}
          disabled={testing}
          class="btn btn-sm btn-primary disabled:opacity-50"
        >
          {#if testing}
            <RefreshCw class="w-4 h-4 animate-spin" />
          {:else}
            Sync Now
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>