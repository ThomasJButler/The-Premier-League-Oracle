/**
 * AI Match Analysis Service (P3g)
 *
 * Provides natural language match analysis by sending prediction data to
 * the OpenAI chat proxy at /api/chat. This is a supplementary display
 * feature — it does NOT modify numerical prediction probabilities.
 *
 * Uses the same /api/chat endpoint and API key as ChatBot.svelte.
 * Analyses are cached in localStorage for 24 hours per match.
 */

import { getSavedAiModel } from '$lib/constants';

// --- Types ---

export interface AnalysisInput {
  homeTeam: string;
  awayTeam: string;
  matchId: string;
  matchDate: string;
  predictedResult: 'H' | 'D' | 'A';
  confidence: number;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  homeForm: string;
  awayForm: string;
  insights: string[];
  /** Optional enrichment fields (P7b — AI-powered match insights) */
  h2hRecord?: string;
  poissonProbs?: { homeWin: number; draw: number; awayWin: number };
}

interface CachedAnalysis {
  analysis: string;
  timestamp: number;
  matchId: string;
}

// --- Constants ---

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_PREFIX = 'ai_analysis_';
const SETTINGS_KEY = 'ai_analysis_enabled';
const SERVER_KEY_CHECK = 'ai_analysis_server_key';
const API_KEY_STORAGE = 'openai_api_key';

// --- Service ---

class AIAnalysisService {
  private serverKeyAvailable: boolean | null = null;

  /** Whether the user has enabled AI analysis in Settings */
  isEnabled(): boolean {
    return localStorage.getItem(SETTINGS_KEY) === 'true';
  }

  /** Toggle AI analysis on/off */
  setEnabled(enabled: boolean): void {
    localStorage.setItem(SETTINGS_KEY, enabled ? 'true' : 'false');
  }

  /** Whether the user has a local API key stored (synchronous, no server probe) */
  hasLocalApiKey(): boolean {
    return !!localStorage.getItem(API_KEY_STORAGE);
  }

  /** Whether an API key is available (user-provided or server-side) */
  async hasApiKey(): Promise<boolean> {
    if (localStorage.getItem(API_KEY_STORAGE)) return true;
    return this.checkServerKey();
  }

  /**
   * Probe the /api/chat endpoint to check if a server-side key is configured.
   * Caches the result for the session to avoid repeated probes.
   */
  private async checkServerKey(): Promise<boolean> {
    if (this.serverKeyAvailable !== null) return this.serverKeyAvailable;

    // Also check localStorage cache from a previous session
    const cached = localStorage.getItem(SERVER_KEY_CHECK);
    if (cached) {
      try {
        const { available, timestamp } = JSON.parse(cached);
        // Cache server key check for 1 hour
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          this.serverKeyAvailable = available;
          return available;
        }
      } catch {
        // Invalid cache — probe again
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      });
      if (res.status === 400) {
        const data = await res.json();
        // If we get "Messages array required", the server has a key (it passed the key check)
        this.serverKeyAvailable = data.error?.includes('Messages array required') ?? false;
      } else {
        this.serverKeyAvailable = false;
      }
    } catch {
      this.serverKeyAvailable = false;
    }

    try {
      localStorage.setItem(SERVER_KEY_CHECK, JSON.stringify({
        available: this.serverKeyAvailable,
        timestamp: Date.now()
      }));
    } catch {
      // Storage full — not critical
    }

    return this.serverKeyAvailable ?? false;
  }

  /**
   * Get AI analysis for a match prediction.
   * Returns cached analysis if available, otherwise fetches from OpenAI.
   * Returns null if AI analysis is disabled or no API key is available.
   */
  async getAnalysis(input: AnalysisInput): Promise<string | null> {
    if (!this.isEnabled()) return null;

    // Check cache first
    const cached = this.getCachedAnalysis(input.matchId);
    if (cached) return cached;

    // Ensure we have an API key
    const keyAvailable = await this.hasApiKey();
    if (!keyAvailable) return null;

    // Fetch from OpenAI
    try {
      const analysis = await this.fetchAnalysis(input);
      if (analysis) {
        this.cacheAnalysis(input.matchId, analysis);
        return analysis;
      }
    } catch (err) {
      console.warn('AI analysis failed:', err instanceof Error ? err.message : err);
    }

    return null;
  }

  /** Retrieve a cached analysis if it exists and hasn't expired */
  getCachedAnalysis(matchId: string): string | null {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${matchId}`);
      if (!raw) return null;
      const parsed: CachedAnalysis = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > CACHE_TTL) {
        localStorage.removeItem(`${STORAGE_PREFIX}${matchId}`);
        return null;
      }
      return parsed.analysis;
    } catch {
      return null;
    }
  }

  /** Store an analysis in localStorage with a timestamp */
  private cacheAnalysis(matchId: string, analysis: string): void {
    const entry: CachedAnalysis = {
      analysis,
      timestamp: Date.now(),
      matchId,
    };
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${matchId}`, JSON.stringify(entry));
    } catch {
      // Storage full — evict oldest analyses and retry
      this.evictOldestCache();
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${matchId}`, JSON.stringify(entry));
      } catch {
        // Still can't store — give up silently
      }
    }
  }

  /** Remove the oldest half of cached analyses when storage is full */
  private evictOldestCache(): void {
    const entries: Array<{ key: string; timestamp: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key)!);
          entries.push({ key, timestamp: parsed.timestamp ?? 0 });
        } catch {
          // Corrupt entry — remove it
          if (key) localStorage.removeItem(key);
        }
      }
    }
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = Math.max(1, Math.floor(entries.length / 2));
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(entries[i].key);
    }
  }

  /** Build the analysis prompt from prediction data */
  private buildPrompt(input: AnalysisInput): string {
    const resultLabel =
      input.predictedResult === 'H' ? `${input.homeTeam} win` :
      input.predictedResult === 'A' ? `${input.awayTeam} win` : 'Draw';

    // Build optional sections only when enrichment data is available
    const sections: string[] = [];

    sections.push(`Analyse this upcoming Premier League match as a football expert. Be concise (150–200 words max), insightful, and data-driven. Use UK English.`);

    sections.push(`Match: ${input.homeTeam} vs ${input.awayTeam}
Date: ${input.matchDate}
Model Prediction: ${resultLabel} (${(input.confidence * 100).toFixed(0)}% confidence)
Predicted Score: ${input.predictedHomeGoals}–${input.predictedAwayGoals}`);

    if (input.poissonProbs) {
      sections.push(`Poisson Model: Home ${(input.poissonProbs.homeWin * 100).toFixed(0)}% | Draw ${(input.poissonProbs.draw * 100).toFixed(0)}% | Away ${(input.poissonProbs.awayWin * 100).toFixed(0)}%`);
    }

    sections.push(`Statistical Factors:\n${input.insights.map(i => `- ${i}`).join('\n')}`);

    const fmtForm = (f: string) => (!f || f === 'N/A' || f === '?????') ? 'Not available' : f;
    sections.push(`Recent Form:\n- ${input.homeTeam}: ${fmtForm(input.homeForm)}\n- ${input.awayTeam}: ${fmtForm(input.awayForm)}`);

    if (input.h2hRecord && input.h2hRecord !== '-' && input.h2hRecord !== 'No H2H data') {
      sections.push(`Head-to-Head: ${input.h2hRecord}`);
    }

    sections.push(`Provide:
1. A brief narrative explaining why this result is likely
2. Key tactical or form factors the model has identified
3. Any risks or uncertainties (fixture congestion, derby intensity, momentum shifts)
4. A confidence qualifier — is the model's confidence justified given the data?

Do NOT invent specific injury news, transfer rumours, or manager quotes. Only reference factors visible in the data above. Be honest about limitations.`);

    return sections.join('\n\n');
  }

  /** Call the /api/chat proxy with the analysis prompt */
  private async fetchAnalysis(input: AnalysisInput): Promise<string | null> {
    const apiKey = localStorage.getItem(API_KEY_STORAGE);

    const body: Record<string, unknown> = {
      messages: [
        {
          role: 'system',
          content: 'You are a Premier League football analyst. Provide concise, data-driven match analysis in UK English. Do not modify or contradict the statistical model\'s predictions — your role is to add qualitative context. Format with markdown: **bold** for emphasis, bullet points for lists.',
        },
        {
          role: 'user',
          content: this.buildPrompt(input),
        },
      ],
      model: getSavedAiModel(),
    };

    // Always send user key — server prioritises its own env var anyway
    if (apiKey) {
      body.apiKey = apiKey;
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: '' }));
      throw new Error(errData.error || `AI analysis error (${response.status})`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  }

  /**
   * Get recent cached analyses for enriching ChatBot context.
   * Returns the most recent analyses that haven't expired.
   */
  getRecentAnalyses(limit = 5): Array<{ matchId: string; analysis: string }> {
    const entries: Array<{ matchId: string; analysis: string; timestamp: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        try {
          const parsed: CachedAnalysis = JSON.parse(localStorage.getItem(key)!);
          if (Date.now() - parsed.timestamp <= CACHE_TTL) {
            entries.push(parsed);
          }
        } catch {
          // Skip invalid entries
        }
      }
    }
    return entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(({ matchId, analysis }) => ({ matchId, analysis }));
  }

  /** Clear all cached AI analyses */
  clearCache(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

}

export const aiAnalysisService = new AIAnalysisService();
