import { supabase } from '../lib/supabase';

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
}

class AIService {
  private apiKey: string | null = null;
  private provider: 'openai' | 'anthropic' = 'openai';
  private model: string = 'gpt-4-turbo-preview';
  
  constructor() {
    this.loadApiKey();
  }
  
  private loadApiKey(): void {
    const savedKey = localStorage.getItem('ai_api_key');
    const savedProvider = localStorage.getItem('ai_provider') as 'openai' | 'anthropic';
    const savedModel = localStorage.getItem('ai_model');
    
    if (savedKey) this.apiKey = savedKey;
    if (savedProvider) this.provider = savedProvider;
    if (savedModel) this.model = savedModel;
  }
  
  public setApiKey(key: string, provider: 'openai' | 'anthropic' = 'openai', model?: string): void {
    this.apiKey = key;
    this.provider = provider;
    
    if (model) {
      this.model = model;
    } else {
      this.model = provider === 'openai' ? 'gpt-4-turbo-preview' : 'claude-3-opus-20240229';
    }
    
    localStorage.setItem('ai_api_key', key);
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('ai_model', this.model);
  }
  
  public hasApiKey(): boolean {
    return !!this.apiKey;
  }
  
  public clearApiKey(): void {
    this.apiKey = null;
    localStorage.removeItem('ai_api_key');
    localStorage.removeItem('ai_provider');
    localStorage.removeItem('ai_model');
  }
  
  private async getMatchContext(): Promise<string> {
    try {
      // Get recent matches and upcoming fixtures
      const { data: recentMatches } = await supabase
        .from('matches')
        .select('*')
        .lt('date', new Date().toISOString())
        .order('date', { ascending: false })
        .limit(5);
      
      const { data: upcomingMatches } = await supabase
        .from('matches')
        .select('*')
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(5);
      
      // Get current season stats
      const { data: teamStats } = await supabase
        .from('team_stats')
        .select('*')
        .order('points', { ascending: false })
        .limit(6);
      
      let context = 'Current Premier League Context:\n\n';
      
      if (teamStats && teamStats.length > 0) {
        context += 'Top 6 Teams:\n';
        teamStats.forEach((team, idx) => {
          context += `${idx + 1}. ${team.team_name}: ${team.points} pts (W${team.wins} D${team.draws} L${team.losses})\n`;
        });
        context += '\n';
      }
      
      if (recentMatches && recentMatches.length > 0) {
        context += 'Recent Results:\n';
        recentMatches.forEach(match => {
          if (match.home_goals !== null && match.away_goals !== null) {
            const date = new Date(match.date).toLocaleDateString();
            context += `${date}: ${match.home_team} ${match.home_goals}-${match.away_goals} ${match.away_team}\n`;
          }
        });
        context += '\n';
      }
      
      if (upcomingMatches && upcomingMatches.length > 0) {
        context += 'Upcoming Fixtures:\n';
        upcomingMatches.forEach(match => {
          const date = new Date(match.date).toLocaleDateString();
          context += `${date}: ${match.home_team} vs ${match.away_team}\n`;
        });
      }
      
      return context;
    } catch (error) {
      console.error('Error fetching match context:', error);
      return '';
    }
  }
  
  public async sendMessage(userMessage: string, conversationHistory: AIMessage[] = []): Promise<AIResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'No API key configured. Please add your API key in settings.'
      };
    }
    
    try {
      // Get current match context
      const matchContext = await this.getMatchContext();
      
      // Build system message with context
      const systemMessage: AIMessage = {
        role: 'system',
        content: `You are the Premier League Oracle AI Assistant, an expert in football analytics, predictions, and betting strategies. 
        
${matchContext}

You have access to comprehensive Premier League data including:
- Historical match results and statistics
- Team performance metrics and form
- Expected Goals (xG) data
- Head-to-head records
- Betting odds and market movements

Provide insightful, data-driven responses about:
- Match predictions and analysis
- Team and player performance
- Betting strategies and value identification
- Statistical trends and patterns
- Tactical analysis

Always base your responses on data and statistical analysis. When discussing predictions, mention confidence levels and key factors influencing the outcome.`
      };
      
      // Prepare messages for API
      const messages: AIMessage[] = [
        systemMessage,
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];
      
      if (this.provider === 'openai') {
        return await this.callOpenAI(messages);
      } else {
        return await this.callAnthropic(messages);
      }
    } catch (error) {
      console.error('Error in AI service:', error);
      return {
        success: false,
        error: 'Failed to get AI response. Please check your API key and try again.'
      };
    }
  }
  
  private async callOpenAI(messages: AIMessage[]): Promise<AIResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      
      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid API key. Please check your OpenAI API key.'
        };
      } else if (response.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.'
        };
      } else {
        return {
          success: false,
          error: error.error?.message || 'Failed to get response from OpenAI.'
        };
      }
    }
    
    const data = await response.json();
    return {
      success: true,
      message: data.choices[0].message.content
    };
  }
  
  private async callAnthropic(messages: AIMessage[]): Promise<AIResponse> {
    // Convert messages format for Anthropic API
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        system: systemMessage,
        messages: userMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        })),
        max_tokens: 1000,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Anthropic API error:', error);
      
      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid API key. Please check your Anthropic API key.'
        };
      } else if (response.status === 429) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.'
        };
      } else {
        return {
          success: false,
          error: error.error?.message || 'Failed to get response from Anthropic.'
        };
      }
    }
    
    const data = await response.json();
    return {
      success: true,
      message: data.content[0].text
    };
  }
  
  public async generatePredictionAnalysis(homeTeam: string, awayTeam: string): Promise<string> {
    if (!this.hasApiKey()) {
      return 'AI analysis requires an API key. Please configure your API key in settings.';
    }
    
    const prompt = `Analyze the upcoming match between ${homeTeam} (home) and ${awayTeam} (away). 

Provide a detailed analysis including:
1. Current form and recent performance of both teams
2. Head-to-head record and historical patterns
3. Key players and potential impact
4. Tactical considerations
5. Predicted outcome with confidence level
6. Potential value bets if any
7. Key factors that could influence the result

Base your analysis on the available data and statistical trends.`;
    
    const response = await this.sendMessage(prompt);
    
    if (response.success && response.message) {
      return response.message;
    } else {
      return `Unable to generate AI analysis: ${response.error || 'Unknown error'}`;
    }
  }
  
  public async analyzeBettingValue(
    predictedProb: number,
    bookmakerOdds: number,
    outcome: string
  ): Promise<string> {
    if (!this.hasApiKey()) {
      return 'AI analysis requires an API key.';
    }
    
    const impliedProb = 1 / bookmakerOdds;
    const edge = predictedProb - impliedProb;
    const expectedValue = (predictedProb * bookmakerOdds) - 1;
    
    const prompt = `Analyze this betting opportunity:
- Outcome: ${outcome}
- Our predicted probability: ${(predictedProb * 100).toFixed(1)}%
- Bookmaker odds: ${bookmakerOdds.toFixed(2)} (implied probability: ${(impliedProb * 100).toFixed(1)}%)
- Edge: ${(edge * 100).toFixed(1)}%
- Expected Value: ${(expectedValue * 100).toFixed(1)}%

Is this a value bet? What stake size would you recommend using Kelly Criterion? What are the risks?`;
    
    const response = await this.sendMessage(prompt);
    
    if (response.success && response.message) {
      return response.message;
    } else {
      return 'Unable to analyze betting value.';
    }
  }
}

export const aiService = new AIService();
export type { AIMessage, AIResponse };