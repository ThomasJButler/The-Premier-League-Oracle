<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../lib/supabase';
  
  let question = '';
  let answer = '';
  let loading = false;
  let chatHistory: {question: string, answer: string}[] = [];
  
  async function askQuestion() {
    if (!question.trim()) return;
    
    loading = true;
    const userQuestion = question;
    question = '';
    
    try {
      // This is where you'd integrate with a real AI service
      // For now, we'll use a simple pattern matching system
      let response = await generateResponse(userQuestion);
      
      chatHistory = [...chatHistory, {
        question: userQuestion,
        answer: response
      }];
    } catch (error) {
      console.error('Error asking question:', error);
    } finally {
      loading = false;
    }
  }
  
  async function generateResponse(question: string): Promise<string> {
    // Simple keyword matching for demo purposes
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('best team') || lowerQuestion.includes('strongest team')) {
      // Query for team with highest win percentage
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
      // Query for team with most goals scored
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
      // Get next upcoming match
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
      // Get team with most clean sheets
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
      // Get overall prediction accuracy
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
    
    // Default response
    return "I'm still learning about football statistics. Try asking about the best team, most goals, clean sheets, or upcoming matches!";
  }
  
  onMount(() => {
    // Any initialization code
  });
</script>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h2 class="text-2xl font-bold gradient-text">Football Oracle AI</h2>
    <p class="text-gray-600 dark:text-gray-400">Ask me anything about Premier League stats</p>
  </div>
  
  <div class="card max-h-96 overflow-y-auto">
    {#if chatHistory.length === 0}
      <div class="p-6 text-center text-gray-500 dark:text-gray-400">
        <p>Ask me about team performance, match statistics, or predictions!</p>
        <p class="mt-2 text-sm">Try questions like "Which team scores the most goals?" or "Who has the best defensive record?"</p>
      </div>
    {:else}
      <div class="space-y-4 p-2">
        {#each chatHistory as chat}
          <div class="flex flex-col space-y-2">
            <div class="bg-gray-100 dark:bg-dark-bg p-3 rounded-lg self-end max-w-[80%]">
              <p class="text-gray-800 dark:text-dark-text">{chat.question}</p>
            </div>
            <div class="bg-primary-100 dark:bg-primary-900/20 p-3 rounded-lg self-start max-w-[80%]">
              <p class="text-primary-800 dark:text-primary-400">{chat.answer}</p>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
  
  <form on:submit|preventDefault={askQuestion} class="flex space-x-2">
    <input
      bind:value={question}
      class="form-input flex-grow"
      placeholder="Ask about Premier League stats..."
      disabled={loading}
    />
    <button type="submit" class="btn btn-primary" disabled={loading || !question.trim()}>
      {#if loading}
        <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
        Thinking...
      {:else}
        Ask
      {/if}
    </button>
  </form>
</div>