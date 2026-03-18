<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Key, Shield, Zap, BookOpen, Info, ExternalLink, X } from 'lucide-svelte';
  import { footballDataAPI } from '../services/api/footballData';
  import { dataService } from '../services/dataService';
  
  const dispatch = createEventDispatcher();
  
  let apiKey = '';
  let isValidating = false;
  let currentStep = 1;
  let validationError = '';
  let validationSuccess = false;
  let selectedProvider: 'football-data' = 'football-data';
  
  const steps = [
    { id: 1, title: 'Welcome', icon: Zap },
    { id: 2, title: 'Privacy & Security', icon: Shield },
    { id: 3, title: 'API Setup', icon: Key },
    { id: 4, title: 'Ready!', icon: BookOpen }
  ];
  
  async function validateAndSave() {
    if (!apiKey.trim()) return;
    
    isValidating = true;
    validationError = '';
    validationSuccess = false;
    
    // Testing API key validation
    
    try {
      const api = footballDataAPI;
      
      // Set the API key
      api.setApiKey(apiKey.trim());
      
      // Test the connection
      const isConnected = await api.testConnection();
      
      // API connection test completed
      
      if (isConnected) {
        validationSuccess = true;

        // Save to localStorage
        localStorage.setItem('football_data_api_key', apiKey.trim());

        // Clear stale cache so fresh data loads with the new key
        await dataService.clearCache();

        // Move to final step
        currentStep = 4;
      } else {
        validationError = `Invalid API key. Please check that you copied it correctly from ${
          'Football-Data.org'
        }.`;
      }
    } catch (error) {
      // Network error during API validation
      validationError = 'Connection failed. Please check your internet connection and try again.';
    } finally {
      isValidating = false;
    }
  }
  
  function nextStep() {
    if (currentStep < 4) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
    }
  }

  function dismiss() {
    dispatch('complete', { apiKey: '', provider: selectedProvider });
  }
</script>

<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="presentation">
  <div class="bg-card rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col" role="dialog" aria-modal="true" aria-label="API Setup Wizard">
    <div class="flex-shrink-0">
    <!-- Header -->
    <div class="p-8 pb-0">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold font-display text-foreground">Premier League Oracle</h1>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            {#each steps as step}
              <div
                class="w-3 h-3 rounded-full transition-all duration-300 {currentStep >= step.id ? 'bg-primary' : 'bg-border'}"
              ></div>
            {/each}
          </div>
          <button
            on:click={dismiss}
            class="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Skip setup wizard"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <!-- Step indicator -->
      <div class="flex items-center gap-3 mb-8">
        <div class="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center text-white">
          <svelte:component this={steps[currentStep - 1].icon} class="w-6 h-6" />
        </div>
        <div>
          <p class="text-sm text-muted-foreground">Step {currentStep} of {steps.length}</p>
          <h2 class="text-xl font-semibold">{steps[currentStep - 1].title}</h2>
        </div>
      </div>
    </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 px-8 pb-8 overflow-y-auto min-h-0">
      {#if currentStep === 1}
        <!-- Welcome Step -->
        <div class="text-center space-y-6">
          <div class="w-20 h-20 mx-auto bg-gradient-to-r from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
            <Zap class="w-10 h-10 text-primary" />
          </div>
          <div>
            <h3 class="text-2xl font-bold mb-4">Welcome to Premier League Oracle</h3>
            <p class="text-muted-foreground text-lg leading-relaxed">
              Get data-driven Premier League predictions using ELO ratings, Poisson models,
              and ensemble statistical analysis.
            </p>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div class="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl">
              <div class="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center mb-3">
                <Zap class="w-4 h-4 text-blue-600" />
              </div>
              <h4 class="font-semibold mb-1">Live Predictions</h4>
              <p class="text-sm text-muted-foreground">Real-time match predictions with confidence scores</p>
            </div>
            
            <div class="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
              <div class="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-lg flex items-center justify-center mb-3">
                <Shield class="w-4 h-4 text-green-600" />
              </div>
              <h4 class="font-semibold mb-1">Privacy First</h4>
              <p class="text-sm text-muted-foreground">Your API key stays local, never shared</p>
            </div>
            
            <div class="p-4 bg-gradient-to-br from-slate-50 to-teal-50 dark:from-slate-900/20 dark:to-teal-900/20 rounded-xl">
              <div class="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mb-3">
                <BookOpen class="w-4 h-4 text-teal-600" />
              </div>
              <h4 class="font-semibold mb-1">Research Tool</h4>
              <p class="text-sm text-muted-foreground">For educational and research purposes only</p>
            </div>
          </div>
        </div>
        
      {:else if currentStep === 2}
        <!-- Privacy & Security Step -->
        <div class="space-y-4">
          <div class="text-center">
            <div class="w-12 h-12 mx-auto bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mb-3">
              <Shield class="w-6 h-6 text-green-600" />
            </div>
            <h3 class="text-xl font-bold mb-1">Privacy & Security</h3>
            <p class="text-sm text-muted-foreground">Your data and privacy are our top priority</p>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 bg-muted rounded-xl">
              <h4 class="font-semibold mb-2 flex items-center gap-2 text-sm">
                <Key class="w-4 h-4 text-blue-600" />
                Local Storage Only
              </h4>
              <p class="text-xs text-muted-foreground">
                Your API key is stored locally in your browser and never transmitted to our servers.
              </p>
            </div>
            
            <div class="p-4 bg-muted rounded-xl">
              <h4 class="font-semibold mb-2 flex items-center gap-2 text-sm">
                <Shield class="w-4 h-4 text-green-600" />
                No Data Collection
              </h4>
              <p class="text-xs text-muted-foreground">
                We don't collect, store, or analyze your personal data or usage patterns.
              </p>
            </div>
            
            <div class="p-4 bg-muted rounded-xl">
              <h4 class="font-semibold mb-2 flex items-center gap-2 text-sm">
                <Zap class="w-4 h-4 text-teal-600" />
                Direct API Calls
              </h4>
              <p class="text-xs text-muted-foreground">
                All data comes directly from your chosen API provider, bypassing our servers.
              </p>
            </div>
            
            <div class="p-4 bg-muted rounded-xl">
              <h4 class="font-semibold mb-2 flex items-center gap-2 text-sm">
                <BookOpen class="w-4 h-4 text-amber-600" />
                Research Purpose
              </h4>
              <p class="text-xs text-muted-foreground">
                This tool is designed for educational and research purposes only.
              </p>
            </div>
          </div>
          
          <div class="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
            <div class="flex items-start gap-2">
              <Info class="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p class="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Important:</strong> This application is for research and educational purposes only. 
                  Please use responsibly and in accordance with your API provider's terms of service.
                </p>
              </div>
            </div>
          </div>
        </div>
        
      {:else if currentStep === 3}
        <!-- API Setup Step -->
        <div class="space-y-6">
          <div class="text-center">
            <div class="w-16 h-16 mx-auto bg-gradient-to-r from-slate-800/20 to-slate-900/20 rounded-full flex items-center justify-center mb-4">
              <Key class="w-8 h-8 text-primary" />
            </div>
            <h3 class="text-2xl font-bold mb-2">API Configuration</h3>
            <p class="text-muted-foreground">
              Enter your Football-Data.org key to get started
            </p>
          </div>
          
          <div class="space-y-4">
            <div>
              <label for="apiKey" class="block text-sm font-medium text-foreground mb-2">
                Football-Data.org API Key
              </label>
              <input
                id="apiKey"
                type="password"
                bind:value={apiKey}
                placeholder="Enter your API key..."
                class="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-muted text-foreground"
                class:border-red-300={apiKey.length > 0 && apiKey.length < 10}
              />
              {#if apiKey.length > 0 && apiKey.length < 10}
                <p class="text-red-600 text-sm mt-1">API key seems too short</p>
              {/if}
              
              <!-- Validation Error Display -->
              {#if validationError}
                <div class="mt-3 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700">
                  <p class="text-red-700 dark:text-red-300 text-sm">{validationError}</p>
                </div>
              {/if}
              
              <!-- Validation Success Display -->
              {#if validationSuccess}
                <div class="mt-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                  <p class="text-green-700 dark:text-green-300 text-sm">✅ API key validated successfully!</p>
                </div>
              {/if}
            </div>
            
            <div class="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
              <div class="flex items-start gap-3">
                <Info class="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p class="text-sm text-amber-800 dark:text-amber-200 mb-2">
                    <strong>Don't have an API key?</strong>
                  </p>
                  <p class="text-sm text-amber-700 dark:text-amber-300 mb-3">
                    Get a free API key from Football-Data.org. The free tier includes 10 requests per minute.
                  </p>
                  <a 
                    href="https://www.football-data.org/client/register" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200"
                  >
                    Get API Key <ExternalLink class="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        
      {:else if currentStep === 4}
        <!-- Success Step -->
        <div class="text-center space-y-6">
          <div class="w-20 h-20 mx-auto bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center">
            <BookOpen class="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h3 class="text-2xl font-bold mb-4 text-green-600">All Set!</h3>
            <p class="text-muted-foreground text-lg">
              Your API key has been validated and saved. You're ready to explore Premier League predictions!
            </p>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <div class="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl">
              <h4 class="font-semibold mb-2">💡 Recommended Usage</h4>
              <ul class="text-sm text-muted-foreground space-y-1">
                <li>• Check daily predictions</li>
                <li>• Monitor team performance</li>
                <li>• Use Kelly Calculator for betting</li>
              </ul>
            </div>
            
            <div class="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
              <h4 class="font-semibold mb-2">📚 Learn More</h4>
              <ul class="text-sm text-muted-foreground space-y-1">
                <li>• View tutorial documentation</li>
                <li>• Understand prediction models</li>
                <li>• Explore value betting</li>
              </ul>
            </div>
          </div>
        </div>
      {/if}
      
    </div>
    
    <!-- Navigation -->
    <div class="flex-shrink-0 px-8 pb-8">
      <div class="flex justify-between items-center pt-6 border-t border-border">
        <button
          on:click={prevStep}
          disabled={currentStep === 1}
          class="btn btn-secondary {currentStep === 1 ? 'opacity-50 cursor-not-allowed' : ''}"
        >
          Previous
        </button>
        
        <div class="flex gap-3">
          {#if currentStep === 3}
            <button
              on:click={validateAndSave}
              disabled={!apiKey.trim() || isValidating}
              class="btn btn-primary {!apiKey.trim() ? 'opacity-50 cursor-not-allowed' : ''}"
            >
              {#if isValidating}
                Validating...
              {:else}
                Validate & Save
              {/if}
            </button>
          {:else if currentStep === 4}
            <button
              on:click={() => {
                dispatch('complete', { apiKey: apiKey.trim(), provider: selectedProvider });
                window.location.reload();
              }}
              class="btn btn-primary"
            >
              Start Using App
            </button>
          {:else}
            <button
              on:click={nextStep}
              class="btn btn-primary"
            >
              Next
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
