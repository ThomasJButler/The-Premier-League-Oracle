import { createClient } from '@supabase/supabase-js'
import type { Match } from '../types'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface StoredPrediction {
  id?: string
  match_id: string
  match_date: string
  home_team: string
  away_team: string
  gameweek?: number
  predicted_result: 'H' | 'D' | 'A'
  confidence_score: number
  predicted_home_goals?: number
  predicted_away_goals?: number
  elo_prediction?: any
  poisson_prediction?: any
  xg_prediction?: any
  combined_model_data?: any
  actual_result?: 'H' | 'D' | 'A'
  actual_home_goals?: number
  actual_away_goals?: number
  was_correct?: boolean
  created_at?: string
  updated_at?: string
}

export interface AccuracyStats {
  total_predictions: number
  correct_predictions: number
  accuracy_percentage: number
  home_predictions: number
  home_correct: number
  draw_predictions: number
  draw_correct: number
  away_predictions: number
  away_correct: number
  avg_confidence: number
  high_confidence_predictions: number
  high_confidence_correct: number
}

class PredictionPersistenceService {
  private isConfigured: boolean = false

  constructor() {
    this.checkConfiguration()
  }

  private checkConfiguration() {
    this.isConfigured = !!(supabaseUrl && supabaseAnonKey)
    if (!this.isConfigured) {
      console.warn('Supabase not configured. Prediction persistence disabled.')
    }
  }

  // Store a new prediction
  async storePrediction(prediction: StoredPrediction): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      return { success: false, error: 'Supabase not configured' }
    }

    try {
      const { data, error } = await supabase
        .from('predictions')
        .insert([prediction])
        .select()
        .single()

      if (error) throw error

      console.log('✅ Prediction stored successfully:', data)
      return { success: true }
    } catch (error) {
      console.error('❌ Error storing prediction:', error)
      return { success: false, error: error.message }
    }
  }

  // Batch store multiple predictions
  async storePredictions(predictions: StoredPrediction[]): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      return { success: false, error: 'Supabase not configured' }
    }

    try {
      const { data, error } = await supabase
        .from('predictions')
        .insert(predictions)
        .select()

      if (error) throw error

      console.log(`✅ ${predictions.length} predictions stored successfully`)
      return { success: true }
    } catch (error) {
      console.error('❌ Error storing predictions:', error)
      return { success: false, error: error.message }
    }
  }

  // Get existing prediction for a match
  async getMatchPrediction(matchId: string): Promise<StoredPrediction | null> {
    if (!this.isConfigured) return null

    try {
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned

      return data || null
    } catch (error) {
      console.error('Error fetching prediction:', error)
      return null
    }
  }

  // Get all predictions for a gameweek
  async getGameweekPredictions(gameweek: number): Promise<StoredPrediction[]> {
    if (!this.isConfigured) return []

    try {
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('gameweek', gameweek)
        .order('match_date', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching gameweek predictions:', error)
      return []
    }
  }

  // Get recent predictions
  async getRecentPredictions(limit: number = 10): Promise<StoredPrediction[]> {
    if (!this.isConfigured) return []

    try {
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching recent predictions:', error)
      return []
    }
  }

  // Update prediction with actual results
  async updatePredictionResult(
    matchId: string,
    actualResult: 'H' | 'D' | 'A',
    homeGoals: number,
    awayGoals: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      return { success: false, error: 'Supabase not configured' }
    }

    try {
      // First get the prediction
      const prediction = await this.getMatchPrediction(matchId)
      if (!prediction) {
        return { success: false, error: 'No prediction found for this match' }
      }

      // Update with actual result
      const wasCorrect = prediction.predicted_result === actualResult
      
      const { error } = await supabase
        .from('predictions')
        .update({
          actual_result: actualResult,
          actual_home_goals: homeGoals,
          actual_away_goals: awayGoals,
          was_correct: wasCorrect,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId)

      if (error) throw error

      console.log('✅ Prediction result updated:', { matchId, wasCorrect })
      return { success: true }
    } catch (error) {
      console.error('❌ Error updating prediction result:', error)
      return { success: false, error: error.message }
    }
  }

  // Get accuracy statistics
  async getAccuracyStats(periodType: 'gameweek' | 'month' | 'season' = 'season'): Promise<AccuracyStats | null> {
    if (!this.isConfigured) return null

    try {
      const { data, error } = await supabase
        .from('prediction_accuracy')
        .select('*')
        .eq('period_type', periodType)
        .order('period_end', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return data || null
    } catch (error) {
      console.error('Error fetching accuracy stats:', error)
      return null
    }
  }

  // Get historical accuracy trend
  async getAccuracyTrend(limit: number = 10): Promise<AccuracyStats[]> {
    if (!this.isConfigured) return []

    try {
      const { data, error } = await supabase
        .from('prediction_accuracy')
        .select('*')
        .eq('period_type', 'gameweek')
        .order('period_start', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching accuracy trend:', error)
      return []
    }
  }

  // Subscribe to weekly predictions
  async subscribeToNotifications(
    email: string,
    preferences: {
      weekly_predictions?: boolean
      high_confidence?: boolean
      value_bets?: boolean
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      return { success: false, error: 'Supabase not configured' }
    }

    try {
      const { error } = await supabase
        .from('notification_subscriptions')
        .upsert({
          email,
          notify_weekly_predictions: preferences.weekly_predictions ?? true,
          notify_high_confidence: preferences.high_confidence ?? true,
          notify_value_bets: preferences.value_bets ?? true,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'email'
        })

      if (error) throw error

      console.log('✅ Notification subscription updated')
      return { success: true }
    } catch (error) {
      console.error('❌ Error updating subscription:', error)
      return { success: false, error: error.message }
    }
  }

  // Check if predictions exist for upcoming matches
  async checkPredictionCoverage(matches: Match[]): Promise<Map<string, boolean>> {
    if (!this.isConfigured) return new Map()

    try {
      const matchIds = matches.map(m => m.id)
      
      const { data, error } = await supabase
        .from('predictions')
        .select('match_id')
        .in('match_id', matchIds)

      if (error) throw error

      const coverageMap = new Map<string, boolean>()
      matchIds.forEach(id => {
        coverageMap.set(id, false)
      })
      
      if (data) {
        data.forEach(pred => {
          coverageMap.set(pred.match_id, true)
        })
      }

      return coverageMap
    } catch (error) {
      console.error('Error checking prediction coverage:', error)
      return new Map()
    }
  }

  // Calculate ROI for betting predictions
  async calculateROI(
    startDate?: string,
    endDate?: string
  ): Promise<{ roi: number; totalBets: number; totalReturn: number } | null> {
    if (!this.isConfigured) return null

    try {
      let query = supabase
        .from('predictions')
        .select('*')
        .not('actual_result', 'is', null)

      if (startDate) {
        query = query.gte('match_date', startDate)
      }
      if (endDate) {
        query = query.lte('match_date', endDate)
      }

      const { data, error } = await query

      if (error) throw error
      if (!data || data.length === 0) return null

      // Simple ROI calculation (would need odds data for accurate calculation)
      const totalBets = data.length
      const correctPredictions = data.filter(p => p.was_correct).length
      const accuracy = correctPredictions / totalBets
      
      // Assuming average odds of 2.5 for simplicity
      const avgOdds = 2.5
      const totalReturn = correctPredictions * avgOdds
      const roi = ((totalReturn - totalBets) / totalBets) * 100

      return {
        roi,
        totalBets,
        totalReturn
      }
    } catch (error) {
      console.error('Error calculating ROI:', error)
      return null
    }
  }

  // Check if service is configured
  isServiceConfigured(): boolean {
    return this.isConfigured
  }
}

// Export singleton instance
export const predictionPersistence = new PredictionPersistenceService()