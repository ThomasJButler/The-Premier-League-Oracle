import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Football-Data.org API configuration
    const FOOTBALL_DATA_API_KEY = Deno.env.get('FOOTBALL_DATA_API_KEY') ?? ''
    const COMPETITION_ID = 2021 // Premier League
    const API_BASE_URL = 'https://api.football-data.org/v4'

    // Fetch upcoming matches for the next gameweek
    const matchesResponse = await fetch(
      `${API_BASE_URL}/competitions/${COMPETITION_ID}/matches?status=SCHEDULED`,
      {
        headers: {
          'X-Auth-Token': FOOTBALL_DATA_API_KEY,
        },
      }
    )

    if (!matchesResponse.ok) {
      throw new Error(`Failed to fetch matches: ${matchesResponse.status}`)
    }

    const matchesData = await matchesResponse.json()
    const matches = matchesData.matches

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No upcoming matches to predict' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current gameweek
    const gameweek = matches[0].matchday

    // Fetch standings for team strength
    const standingsResponse = await fetch(
      `${API_BASE_URL}/competitions/${COMPETITION_ID}/standings`,
      {
        headers: {
          'X-Auth-Token': FOOTBALL_DATA_API_KEY,
        },
      }
    )

    const standingsData = await standingsResponse.json()
    const standings = standingsData.standings[0].table

    // Create team strength map based on current position
    const teamStrength = new Map()
    standings.forEach((team, index) => {
      // Higher position = higher strength (20 - position gives us a scale from 1-20)
      teamStrength.set(team.team.name, {
        position: team.position,
        points: team.points,
        goalDifference: team.goalDifference,
        form: team.form,
        strength: 20 - index,
      })
    })

    // Generate predictions for each match
    const predictions = []
    
    for (const match of matches) {
      if (match.matchday !== gameweek) continue // Only predict current gameweek

      const homeTeam = match.homeTeam.name
      const awayTeam = match.awayTeam.name
      
      const homeStrength = teamStrength.get(homeTeam) || { strength: 10 }
      const awayStrength = teamStrength.get(awayTeam) || { strength: 10 }
      
      // Simple prediction algorithm based on team strength
      const strengthDiff = homeStrength.strength - awayStrength.strength
      const homeAdvantage = 2 // Home advantage factor
      const totalDiff = strengthDiff + homeAdvantage
      
      let predictedResult: 'H' | 'D' | 'A'
      let confidence: number
      
      if (totalDiff > 5) {
        predictedResult = 'H'
        confidence = Math.min(85, 60 + totalDiff * 2)
      } else if (totalDiff < -3) {
        predictedResult = 'A'
        confidence = Math.min(85, 60 + Math.abs(totalDiff) * 2)
      } else {
        predictedResult = 'D'
        confidence = Math.max(40, 60 - Math.abs(totalDiff) * 3)
      }
      
      // Predict goals based on team recent form
      const predictedHomeGoals = Math.round(1.5 + (homeStrength.strength / 10))
      const predictedAwayGoals = Math.round(1.0 + (awayStrength.strength / 15))
      
      const prediction = {
        match_id: match.id.toString(),
        match_date: match.utcDate,
        home_team: homeTeam,
        away_team: awayTeam,
        gameweek: gameweek,
        predicted_result: predictedResult,
        confidence_score: confidence,
        predicted_home_goals: predictedHomeGoals,
        predicted_away_goals: predictedAwayGoals,
        combined_model_data: {
          home_strength: homeStrength,
          away_strength: awayStrength,
          strength_difference: totalDiff,
        },
      }
      
      predictions.push(prediction)
      
      // Store individual prediction
      const { error: predictionError } = await supabaseClient
        .from('predictions')
        .insert(prediction)
      
      if (predictionError) {
        console.error('Error storing prediction:', predictionError)
      }
    }
    
    // Store weekly predictions summary
    const { error: weeklyError } = await supabaseClient
      .from('weekly_predictions')
      .insert({
        gameweek: gameweek,
        season: '2024/25',
        total_matches: matches.filter(m => m.matchday === gameweek).length,
        predictions_made: predictions.length,
        predictions_data: predictions,
      })
    
    if (weeklyError) {
      console.error('Error storing weekly predictions:', weeklyError)
    }
    
    // Send notifications to subscribers
    const { data: subscribers } = await supabaseClient
      .from('notification_subscriptions')
      .select('*')
      .eq('is_active', true)
      .eq('notify_weekly_predictions', true)
    
    if (subscribers && subscribers.length > 0) {
      // Get high confidence predictions for notification
      const highConfidencePreds = predictions.filter(p => p.confidence_score > 75)
      
      for (const subscriber of subscribers) {
        // Send email notification (would need to configure email service)
        console.log(`Would send notification to ${subscriber.email}`)
        
        // Update last notified timestamp
        await supabaseClient
          .from('notification_subscriptions')
          .update({ last_notified_at: new Date().toISOString() })
          .eq('id', subscriber.id)
      }
      
      // Update weekly predictions with notification status
      await supabaseClient
        .from('weekly_predictions')
        .update({
          notifications_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq('gameweek', gameweek)
        .eq('season', '2024/25')
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        gameweek: gameweek,
        predictions_count: predictions.length,
        subscribers_notified: subscribers?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error in weekly predictions:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})