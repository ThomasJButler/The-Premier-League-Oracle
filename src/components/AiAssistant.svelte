<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  let question = '';
  let answer = '';
  let loading = false;
  let chatHistory: {question: string, answer: string}[] = [];
  let chatContainer: HTMLElement;

  async function askQuestion() {
    if (!question.trim()) return;
    
    loading = true;
    const userQuestion = question;
    question = '';
    
    try {
      let response = await generateResponse(userQuestion);
      
      chatHistory = [...chatHistory, {
        question: userQuestion,
        answer: response
      }];
      
      // Scroll to bottom after update
      setTimeout(() => {
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 0);
    } catch (error) {
      console.error('Error asking question:', error);
    } finally {
      loading = false;
    }
  }
  
  async function generateResponse(question: string): Promise<string> {
    const lowerQuestion = question.toLowerCase();
    
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
    
    if (lowerQuestion.includes('next match') || lowerQuestion.includes('upcoming') || lowerQuestion.includes('future match')) {
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
    
    if (lowerQuestion.includes('clean sheet') || lowerQuestion.includes('defense') || lowerQuestion.includes('defence')) {
      const { data } = await supabase
        .from('team_stats')
        .select('team_name, clean_sheets')
        .order('clean_sheets', { ascending: false })
        .limit(1);
        
      if (data && data.length > 0) {
        return `${data[0].team_name} has the best defense with ${data[0].clean_sheets} clean sheets this season.`;
      }
    }
    
    if (lowerQuestion.includes('prediction accuracy') || lowerQuestion.includes('how accurate')) {
      const { data } = await supabase
        .from('predictions')
        .select('was_correct');
        
      if (data && data.length > 0) {
        const correct = data.filter((p: { was_correct: boolean }) => p.was_correct).length;
        const total = data.length;
        const accuracy = (correct / total * 100).toFixed(1);
        return `The prediction model has an accuracy of ${accuracy}% (${correct} correct predictions out of ${total}).`;
      }
    }
    
    if (lowerQuestion.includes('biggest surprise') || lowerQuestion.includes('upset')) {
      return "The biggest upset this season was when Norwich City defeated Manchester City 3-2, despite having only 24% possession and being 100/1 underdogs.";
    }
    
    if (lowerQuestion.includes('fun fact') || lowerQuestion.includes('interesting fact')) {
      const funFacts = [
        "Only 7 clubs have won the Premier League since its formation in 1992: Man United, Man City, Chelsea, Arsenal, Liverpool, Leicester City, and Blackburn Rovers.",
        "The fastest goal in Premier League history was scored by Shane Long after just 7.69 seconds.",
        "Ryan Giggs scored in 23 consecutive Premier League seasons from 1992-93 to 2012-13.",
        "The record for most goals in a single Premier League game is 5, shared by Andy Cole, Alan Shearer, Jermain Defoe, Dimitar Berbatov, and Sergio Agüero."
      ];
      return funFacts[Math.floor(Math.random() * funFacts.length)];
    }
    
    return "I'm still learning about football statistics. Try asking about the best team, most goals, clean sheets, or upcoming matches!";
  }
  
  onMount(() => {
    // Any initialization code
  });
</script>

<div class="card card-glass p-4 sm:p-6 h-full flex flex-col">
  <!-- Use card-glass and adjust padding -->
  <h2 class="text-xl font-semibold mb-4 gradient-text">AI Assistant</h2>
  <!-- Use gradient-text -->

  <div
    bind:this={chatContainer}
    class="chat-history flex-grow overflow-y-auto mb-4 space-y-4 p-3 bg-slate-100/20 dark:bg-slate-800/30 rounded-lg border border-slate-200/20 dark:border-slate-700/20"
  >
    <!-- Adjusted background, padding, border -->
    {#each chatHistory as chat, i (i)}
    <!-- Added key for transition -->
      <!-- User Message -->
      <div class="flex justify-end" transition:fly={{ y: 20, duration: 300, easing: quintOut }}>
        <div class="chat-bubble user-bubble relative bg-gradient-to-br from-primary/80 to-accent/80 text-white p-3 rounded-lg rounded-br-none max-w-md shadow-md">
          <!-- Gradient, shadow, rounded corner -->
          <p class="text-sm">{chat.question}</p>
          <div class="absolute bottom-1 right-2 text-xs opacity-60">You</div>
          <!-- Label -->
        </div>
      </div>
      <!-- AI Message -->
      <div class="flex justify-start" transition:fly={{ y: 20, duration: 300, delay: 150, easing: quintOut }}>
        <div class="chat-bubble ai-bubble relative bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 p-3 rounded-lg rounded-bl-none max-w-md shadow-md border border-slate-200/50 dark:border-slate-700/50">
          <!-- Adjusted bg, border, shadow, rounded corner -->
          <p class="text-sm">{chat.answer}</p>
          <div class="absolute bottom-1 left-2 text-xs text-slate-500 dark:text-slate-400 opacity-80">Oracle</div>
          <!-- Label -->
        </div>
      </div>
    {/each}
    {#if loading}
      <div class="flex justify-start">
        <div class="chat-bubble ai-bubble bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 p-3 rounded-lg rounded-bl-none max-w-xs shadow-md border border-slate-200/50 dark:border-slate-700/50">
          <div class="flex items-center space-x-2">
             <div class="w-2 h-2 bg-primary rounded-full animate-pulse" style="animation-delay: 0ms;"></div>
             <div class="w-2 h-2 bg-primary rounded-full animate-pulse" style="animation-delay: 150ms;"></div>
             <div class="w-2 h-2 bg-primary rounded-full animate-pulse" style="animation-delay: 300ms;"></div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <form on:submit|preventDefault={askQuestion} class="chat-input flex items-center gap-2 border-t border-slate-200/50 dark:border-slate-700/50 pt-4">
    <!-- Added top border -->
    <input
      type="text"
      bind:value={question}
      placeholder="Ask the Oracle..."
      class="form-input flex-grow"
      disabled={loading}
    />
    <!-- Use form-input -->
    <button type="submit" class="btn btn-primary" disabled={loading || !question.trim()}>
      <!-- Use btn btn-primary -->
      {#if loading}
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Sending</span>
      {:else}
         <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
        <span>Send</span>
      {/if}
    </button>
  </form>
</div>