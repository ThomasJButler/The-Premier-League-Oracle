-- Create predictions table to store all predictions
CREATE TABLE IF NOT EXISTS public.predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id TEXT NOT NULL,
    match_date TIMESTAMP WITH TIME ZONE NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    gameweek INTEGER,
    
    -- Prediction details
    predicted_result TEXT CHECK (predicted_result IN ('H', 'D', 'A')) NOT NULL,
    confidence_score DECIMAL(5, 2) NOT NULL,
    predicted_home_goals INTEGER,
    predicted_away_goals INTEGER,
    
    -- Model predictions
    elo_prediction JSONB,
    poisson_prediction JSONB,
    xg_prediction JSONB,
    combined_model_data JSONB,
    
    -- Actual results (updated after match)
    actual_result TEXT CHECK (actual_result IN ('H', 'D', 'A')),
    actual_home_goals INTEGER,
    actual_away_goals INTEGER,
    was_correct BOOLEAN,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate predictions
    UNIQUE(match_id, created_at)
);

-- Create index for faster queries
CREATE INDEX idx_predictions_match_date ON predictions(match_date);
CREATE INDEX idx_predictions_gameweek ON predictions(gameweek);
CREATE INDEX idx_predictions_teams ON predictions(home_team, away_team);
CREATE INDEX idx_predictions_created_at ON predictions(created_at);

-- Create prediction_accuracy table for tracking model performance
CREATE TABLE IF NOT EXISTS public.prediction_accuracy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type TEXT CHECK (period_type IN ('gameweek', 'month', 'season')) NOT NULL,
    
    -- Overall stats
    total_predictions INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    accuracy_percentage DECIMAL(5, 2),
    
    -- Result type breakdowns
    home_predictions INTEGER DEFAULT 0,
    home_correct INTEGER DEFAULT 0,
    draw_predictions INTEGER DEFAULT 0,
    draw_correct INTEGER DEFAULT 0,
    away_predictions INTEGER DEFAULT 0,
    away_correct INTEGER DEFAULT 0,
    
    -- Model performance
    avg_confidence DECIMAL(5, 2),
    high_confidence_predictions INTEGER DEFAULT 0, -- confidence > 70%
    high_confidence_correct INTEGER DEFAULT 0,
    
    -- Financial metrics (for Kelly betting)
    total_units_bet DECIMAL(10, 2),
    total_return DECIMAL(10, 2),
    roi_percentage DECIMAL(5, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(period_start, period_end, period_type)
);

-- Create weekly_predictions table for scheduled predictions
CREATE TABLE IF NOT EXISTS public.weekly_predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gameweek INTEGER NOT NULL,
    season TEXT NOT NULL,
    prediction_run_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Summary stats
    total_matches INTEGER,
    predictions_made INTEGER,
    
    -- Notification status
    notifications_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Prediction data
    predictions_data JSONB NOT NULL, -- Array of prediction objects
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(gameweek, season)
);

-- Create notification_subscriptions table
CREATE TABLE IF NOT EXISTS public.notification_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    push_subscription JSONB, -- Web Push API subscription object
    
    -- Preferences
    notify_weekly_predictions BOOLEAN DEFAULT TRUE,
    notify_high_confidence BOOLEAN DEFAULT TRUE, -- Only notify for confidence > 75%
    notify_value_bets BOOLEAN DEFAULT TRUE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_notified_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to update prediction with actual results
CREATE OR REPLACE FUNCTION update_prediction_result(
    p_match_id TEXT,
    p_actual_result TEXT,
    p_home_goals INTEGER,
    p_away_goals INTEGER
)
RETURNS void AS $$
BEGIN
    UPDATE predictions
    SET 
        actual_result = p_actual_result,
        actual_home_goals = p_home_goals,
        actual_away_goals = p_away_goals,
        was_correct = (predicted_result = p_actual_result),
        updated_at = NOW()
    WHERE match_id = p_match_id
    AND actual_result IS NULL; -- Only update if not already updated
END;
$$ LANGUAGE plpgsql;

-- Function to calculate accuracy for a period
CREATE OR REPLACE FUNCTION calculate_accuracy_stats(
    p_start_date DATE,
    p_end_date DATE,
    p_period_type TEXT
)
RETURNS void AS $$
DECLARE
    v_stats RECORD;
BEGIN
    -- Calculate statistics
    WITH period_stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE was_correct = true) as correct,
            COUNT(*) FILTER (WHERE predicted_result = 'H') as home_pred,
            COUNT(*) FILTER (WHERE predicted_result = 'H' AND was_correct = true) as home_correct,
            COUNT(*) FILTER (WHERE predicted_result = 'D') as draw_pred,
            COUNT(*) FILTER (WHERE predicted_result = 'D' AND was_correct = true) as draw_correct,
            COUNT(*) FILTER (WHERE predicted_result = 'A') as away_pred,
            COUNT(*) FILTER (WHERE predicted_result = 'A' AND was_correct = true) as away_correct,
            AVG(confidence_score) as avg_conf,
            COUNT(*) FILTER (WHERE confidence_score > 70) as high_conf_pred,
            COUNT(*) FILTER (WHERE confidence_score > 70 AND was_correct = true) as high_conf_correct
        FROM predictions
        WHERE DATE(match_date) BETWEEN p_start_date AND p_end_date
        AND actual_result IS NOT NULL
    )
    SELECT * INTO v_stats FROM period_stats;
    
    -- Insert or update accuracy record
    INSERT INTO prediction_accuracy (
        period_start, period_end, period_type,
        total_predictions, correct_predictions, accuracy_percentage,
        home_predictions, home_correct,
        draw_predictions, draw_correct,
        away_predictions, away_correct,
        avg_confidence,
        high_confidence_predictions, high_confidence_correct
    )
    VALUES (
        p_start_date, p_end_date, p_period_type,
        v_stats.total, v_stats.correct, 
        CASE WHEN v_stats.total > 0 THEN (v_stats.correct::DECIMAL / v_stats.total * 100) ELSE 0 END,
        v_stats.home_pred, v_stats.home_correct,
        v_stats.draw_pred, v_stats.draw_correct,
        v_stats.away_pred, v_stats.away_correct,
        v_stats.avg_conf,
        v_stats.high_conf_pred, v_stats.high_conf_correct
    )
    ON CONFLICT (period_start, period_end, period_type)
    DO UPDATE SET
        total_predictions = EXCLUDED.total_predictions,
        correct_predictions = EXCLUDED.correct_predictions,
        accuracy_percentage = EXCLUDED.accuracy_percentage,
        home_predictions = EXCLUDED.home_predictions,
        home_correct = EXCLUDED.home_correct,
        draw_predictions = EXCLUDED.draw_predictions,
        draw_correct = EXCLUDED.draw_correct,
        away_predictions = EXCLUDED.away_predictions,
        away_correct = EXCLUDED.away_correct,
        avg_confidence = EXCLUDED.avg_confidence,
        high_confidence_predictions = EXCLUDED.high_confidence_predictions,
        high_confidence_correct = EXCLUDED.high_confidence_correct,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to predictions" ON predictions
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to accuracy" ON prediction_accuracy
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to weekly predictions" ON weekly_predictions
    FOR SELECT USING (true);

-- Allow users to manage their own subscriptions
CREATE POLICY "Users can manage their own subscriptions" ON notification_subscriptions
    FOR ALL USING (auth.email() = email);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at_predictions
    BEFORE UPDATE ON predictions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_accuracy
    BEFORE UPDATE ON prediction_accuracy
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_subscriptions
    BEFORE UPDATE ON notification_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();