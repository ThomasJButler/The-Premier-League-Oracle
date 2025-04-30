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

<div class="space-y-6 animate-fade-in">
  <div class="text-center">
    <h2 class="text-2xl font-bold gradient-text">Football Oracle AI</h2>
    <p class="text-slate-600 dark:text-slate-400 mt-1">Ask me anything about Premier League stats</p>
  </div>
  
  <div 
    bind:this={chatContainer}
    class="card card-glass h-96 overflow-y-auto p-4 space-y-4 scroll-smooth"
  >
    {#if chatHistory.length === 0}
      <div class="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400">
        <svg class="w-16 h-16 mb-4 text-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
        <p class="font-medium">Ask me about team performance, match statistics, or predictions!</p>
        <p class="mt-1 text-sm">Try questions like "Which team scores the most goals?" or "Who has the best defensive record?"</p>
      </div>
    {:else}
      {#each chatHistory as chat, i (i)}
        <div 
          class="flex justify-end"
          in:fly={{ x: 50, duration: 300, easing: quintOut, delay: 100 }}
        >
          <div class="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg rounded-br-none max-w-[80%] shadow-sm">
            <p class="text-sm text-slate-800 dark:text-slate-200">{chat.question}</p>
          </div>
        </div>
        
        <div 
          class="flex justify-start"
          in:fly={{ y: 20, duration: 400, easing: quintOut, delay: 300 }}
        >
          <div class="bg-white dark:bg-slate-700/50 p-3 rounded-lg rounded-bl-none max-w-[80%] shadow-sm border border-slate-200 dark:border-slate-600/50">
            <p class="text-sm text-slate-700 dark:text-slate-300">{chat.answer}</p>
          </div>
        </div>
      {/each}
    {/if}
    {#if loading}
      <div class="flex justify-start">
        <div class="bg-white dark:bg-slate-700/50 p-3 rounded-lg rounded-bl-none max-w-[80%] shadow-sm border border-slate-200 dark:border-slate-600/50">
          <div class="flex items-center space-x-2">
            <div class="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style="animation-delay: 0ms;"></div>
            <div class="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style="animation-delay: 200ms;"></div>
            <div class="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style="animation-delay: 400ms;"></div>
          </div>
        </div>
      </div>
    {/if}
  </div>
  
  <form on:submit|preventDefault={askQuestion} class="flex space-x-3 items-center">
    <input
      bind:value={question}
      class="form-input flex-grow hover-scale"
      placeholder="Ask the Oracle..."
      disabled={loading}
    />
    <button 
      type="submit" 
      class="btn btn-primary hover-scale disabled:opacity-50 disabled:transform-none"
      disabled={loading || !question.trim()}
    >
      {#if loading}
        <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
      {:else}
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
      {/if}
    </button>
  </form>
</div>