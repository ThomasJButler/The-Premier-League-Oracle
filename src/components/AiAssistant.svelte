<script lang="ts">
  import { Send, Bot, Lock, Sparkles, ChevronDown } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { supabase } from '../lib/supabase';

  interface Message {
    id: number;
    text: string;
    sender: 'user' | 'assistant';
    timestamp: Date;
  }

  let messages: Message[] = [
    {
      id: 1,
      text: "Hello! I'm your Premier League Oracle assistant. I can help you analyze matches, understand predictions, and provide insights about teams and players. How can I assist you today?",
      sender: 'assistant',
      timestamp: new Date()
    }
  ];

  let inputMessage = '';
  let isTyping = false;
  let chatContainer: HTMLElement;
  let showProModal = false;
  let apiKey = '';
  let hasApiKey = false;

  async function generateSmartResponse(question: string): Promise<string> {
    const lowerQuestion = question.toLowerCase();
    
    // Team performance queries
    if (lowerQuestion.includes('best team') || lowerQuestion.includes('strongest team')) {
      const { data } = await supabase
        .from('team_stats')
        .select('team_name, wins, matches_played')
        .order('wins', { ascending: false })
        .limit(1);
        
      if (data && data.length > 0) {
        const winPercentage = (data[0].wins / data[0].matches_played * 100).toFixed(1);
        return `Based on current statistics, ${data[0].team_name} has the highest win percentage at ${winPercentage}%.`;
      }
    }
    
    if (lowerQuestion.includes('most goals') || lowerQuestion.includes('highest scoring')) {
      const { data } = await supabase
        .from('team_stats')
        .select('team_name, goals_for, matches_played')
        .order('goals_for', { ascending: false })
        .limit(1);
        
      if (data && data.length > 0) {
        const avgGoals = (data[0].goals_for / data[0].matches_played).toFixed(2);
        return `${data[0].team_name} scores the most goals with ${data[0].goals_for} total goals (${avgGoals} per match).`;
      }
    }
    
    if (lowerQuestion.includes('next match') || lowerQuestion.includes('upcoming')) {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .gt('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(1);
        
      if (data && data.length > 0) {
        const match = data[0];
        const matchDate = new Date(match.date).toLocaleDateString();
        return `The next match is ${match.home_team} vs ${match.away_team} on ${matchDate}.`;
      }
    }
    
    if (lowerQuestion.includes('clean sheet') || lowerQuestion.includes('defense')) {
      const { data } = await supabase
        .from('team_stats')
        .select('team_name, clean_sheets')
        .order('clean_sheets', { ascending: false })
        .limit(1);
        
      if (data && data.length > 0) {
        return `${data[0].team_name} has the best defense with ${data[0].clean_sheets} clean sheets this season.`;
      }
    }
    
    // Fun facts
    if (lowerQuestion.includes('fun fact') || lowerQuestion.includes('interesting')) {
      const funFacts = [
        "Only 7 clubs have won the Premier League since its formation in 1992!",
        "The fastest goal in Premier League history was scored by Shane Long after just 7.69 seconds.",
        "Ryan Giggs scored in 23 consecutive Premier League seasons from 1992-93 to 2012-13.",
        "The record for most goals in a single Premier League game is 5, shared by multiple players."
      ];
      return funFacts[Math.floor(Math.random() * funFacts.length)];
    }
    
    // Default responses
    const responses = [
      "That's a great question! Check out the Season Stats tab for unique insights about this season.",
      "Based on recent form trends, you can find detailed analysis in the Predictions section.",
      "The Dashboard provides real-time updates on all team performances and upcoming matches.",
      "Interesting point! Our prediction models consider multiple factors including form, injuries, and historical data."
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  async function sendMessage() {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: messages.length + 1,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };
    messages = [...messages, userMessage];
    inputMessage = '';

    // Simulate typing
    isTyping = true;
    scrollToBottom();

    try {
      // Generate response based on mode
      const response = hasApiKey 
        ? `[Pro Mode] I'm analyzing your question: "${userMessage.text}". In a real implementation, this would connect to your AI provider for advanced analysis.`
        : await generateSmartResponse(userMessage.text);
      
      // Add delay for realism
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      
      const assistantMessage: Message = {
        id: messages.length + 1,
        text: response,
        sender: 'assistant',
        timestamp: new Date()
      };
      messages = [...messages, assistantMessage];
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage: Message = {
        id: messages.length + 1,
        text: "I apologize, but I encountered an error. Please try again or check the Season Stats for insights!",
        sender: 'assistant',
        timestamp: new Date()
      };
      messages = [...messages, errorMessage];
    } finally {
      isTyping = false;
      scrollToBottom();
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function saveApiKey() {
    if (apiKey.trim()) {
      hasApiKey = true;
      localStorage.setItem('ai_api_key', apiKey);
      showProModal = false;
      messages = [...messages, {
        id: messages.length + 1,
        text: "Great! I've activated Pro mode with your API key. I can now provide more detailed and sophisticated analysis.",
        sender: 'assistant',
        timestamp: new Date()
      }];
    }
  }

  onMount(() => {
    const savedKey = localStorage.getItem('ai_api_key');
    if (savedKey) {
      hasApiKey = true;
      apiKey = savedKey;
    }
    scrollToBottom();
  });
</script>

<div class="ai-assistant flex flex-col h-full max-h-[calc(100vh-12rem)]">
  <!-- Header -->
  <div class="bg-gradient-to-r from-primary/10 to-accent/10 dark:from-primary/20 dark:to-accent/20 rounded-t-xl p-4 border-b border-slate-200 dark:border-slate-700">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="p-2 bg-gradient-to-br from-primary to-accent rounded-lg">
          <Bot class="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">AI Assistant</h2>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {hasApiKey ? 'Pro Mode Active' : 'Free Mode - Smart Responses'}
          </p>
        </div>
      </div>
      
      {#if !hasApiKey}
        <button
          on:click={() => showProModal = true}
          class="btn btn-primary btn-sm flex items-center space-x-2"
        >
          <Sparkles class="w-4 h-4" />
          <span>Upgrade</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Chat Messages -->
  <div 
    bind:this={chatContainer}
    class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50"
  >
    {#each messages as message (message.id)}
      <div 
        class="flex {message.sender === 'user' ? 'justify-end' : 'justify-start'}"
        transition:fly={{ y: 20, duration: 300 }}
      >
        <div class="max-w-[80%] md:max-w-[60%]">
          <div 
            class="rounded-2xl px-4 py-3 {
              message.sender === 'user' 
                ? 'bg-gradient-to-r from-primary to-accent text-white' 
                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }"
          >
            <p class="text-sm whitespace-pre-wrap">{message.text}</p>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 px-2 {
            message.sender === 'user' ? 'text-right' : 'text-left'
          }">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    {/each}
    
    {#if isTyping}
      <div class="flex justify-start" transition:fade>
        <div class="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700">
          <div class="flex space-x-2">
            <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
            <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
            <div class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Input Area -->
  <div class="border-t border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
    <div class="flex items-end space-x-3">
      <textarea
        bind:value={inputMessage}
        on:keydown={handleKeydown}
        placeholder="Ask about teams, matches, or predictions..."
        class="flex-1 resize-none rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[3rem] max-h-[8rem]"
        rows="1"
      />
      <button
        on:click={sendMessage}
        disabled={!inputMessage.trim() || isTyping}
        class="btn btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send class="w-5 h-5" />
      </button>
    </div>
    
    {#if !hasApiKey}
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
        Free mode uses smart database queries. 
        <button on:click={() => showProModal = true} class="text-primary hover:underline">
          Add API key for unlimited AI
        </button>
      </p>
    {/if}
  </div>
</div>

<!-- Pro Modal -->
{#if showProModal}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" transition:fade>
    <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl" transition:fly={{ y: 50 }}>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xl font-bold text-slate-900 dark:text-white">Upgrade to Pro</h3>
        <button 
          on:click={() => showProModal = false}
          class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ChevronDown class="w-5 h-5 text-slate-500" />
        </button>
      </div>
      
      <div class="space-y-4">
        <div class="p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg">
          <h4 class="font-semibold text-slate-900 dark:text-white mb-2">Pro Features</h4>
          <ul class="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <li>• Unlimited AI-powered responses</li>
            <li>• Advanced match analysis</li>
            <li>• Personalized betting insights</li>
            <li>• Real-time strategy recommendations</li>
          </ul>
        </div>
        
        <div class="space-y-3">
          <p class="text-sm text-slate-600 dark:text-slate-400">
            Enter your OpenAI API key or other AI provider key:
          </p>
          <input
            type="password"
            bind:value={apiKey}
            placeholder="sk-..."
            class="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Your API key is stored locally and never sent to our servers.
          </p>
        </div>
        
        <div class="flex space-x-3">
          <button
            on:click={saveApiKey}
            disabled={!apiKey.trim()}
            class="flex-1 btn btn-primary disabled:opacity-50"
          >
            <Lock class="w-4 h-4 mr-2" />
            Save API Key
          </button>
          <button
            on:click={() => showProModal = false}
            class="flex-1 btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  textarea {
    scrollbar-width: thin;
    scrollbar-color: theme('colors.slate.400') transparent;
  }
  
  textarea::-webkit-scrollbar {
    width: 6px;
  }
  
  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  
  textarea::-webkit-scrollbar-thumb {
    background-color: theme('colors.slate.400');
    border-radius: 3px;
  }
</style>