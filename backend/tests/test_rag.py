"""
Tests for the Oracle Chat RAG module and /chat/rag endpoint.

Validates:
- Team name extraction from natural language
- Intent parsing (H2H, form, goals, draws, stats, season, prediction)
- DataFrame query functions return correct markdown context
- /chat/rag endpoint returns 400 without API key
- /chat/rag endpoint validates request body
- RAG prompt builder produces grounded context
"""

import os
import sys
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.api.rag import (
    QueryIntent,
    build_rag_prompt,
    extract_teams,
    init_team_patterns,
    parse_intent,
    query_dataframe,
)
from app.features.free_tier_features import CSV_TO_API, _ALIASES

# Import FastAPI test client
try:
    from fastapi.testclient import TestClient
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

if FASTAPI_AVAILABLE:
    from app.api.main import app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _init_patterns():
    """Initialise team patterns before each test."""
    init_team_patterns(CSV_TO_API, _ALIASES)


def _make_match(
    home: str = 'Arsenal',
    away: str = 'Chelsea',
    hg: int = 2,
    ag: int = 1,
    date: str = '2025-01-15',
    season: str = '2024',
    **kwargs,
) -> dict:
    """Build a single match row with sensible defaults."""
    result = 'H' if hg > ag else ('A' if ag > hg else 'D')
    row = {
        'date': pd.Timestamp(date),
        'home_team': home,
        'away_team': away,
        'home_goals': hg,
        'away_goals': ag,
        'result': result,
        'half_time_home_goals': hg // 2,
        'half_time_away_goals': ag // 2,
        'half_time_result': 'H' if hg // 2 > ag // 2 else ('A' if ag // 2 > hg // 2 else 'D'),
        'home_shots': 12,
        'away_shots': 8,
        'home_shots_target': 5,
        'away_shots_target': 3,
        'home_corners': 6,
        'away_corners': 4,
        'home_yellows': 2,
        'away_yellows': 3,
        'home_reds': 0,
        'away_reds': 0,
        'home_fouls': 10,
        'away_fouls': 12,
        'referee': 'M Oliver',
        'season': season,
    }
    row.update(kwargs)
    return row


@pytest.fixture
def sample_df() -> pd.DataFrame:
    """A small DataFrame with known match data for testing queries."""
    matches = [
        _make_match('Arsenal', 'Chelsea', 2, 1, '2025-01-15'),
        _make_match('Chelsea', 'Arsenal', 0, 0, '2024-10-05'),
        _make_match('Arsenal', 'Chelsea', 3, 2, '2024-04-20'),
        _make_match('Arsenal', 'Liverpool', 1, 1, '2025-01-10'),
        _make_match('Liverpool', 'Arsenal', 2, 0, '2024-09-28'),
        _make_match('Arsenal', 'Tottenham', 3, 0, '2025-01-05'),
        _make_match('Man City', 'Arsenal', 1, 2, '2024-12-20'),
        _make_match('Arsenal', 'Man United', 2, 1, '2024-12-15'),
        _make_match('Chelsea', 'Liverpool', 1, 2, '2025-01-08'),
        _make_match('Liverpool', 'Man City', 3, 1, '2025-01-12'),
    ]
    return pd.DataFrame(matches)


@pytest.fixture
def client():
    """FastAPI test client."""
    if not FASTAPI_AVAILABLE:
        pytest.skip('fastapi not installed')
    return TestClient(app)


# ---------------------------------------------------------------------------
# Tests: Team name extraction
# ---------------------------------------------------------------------------

class TestTeamExtraction:
    """Tests for extracting team names from natural language."""

    def test_extract_single_team(self):
        teams = extract_teams('How is Arsenal doing?')
        assert teams == ['Arsenal']

    def test_extract_two_teams(self):
        teams = extract_teams('Arsenal vs Chelsea')
        assert 'Arsenal' in teams
        assert 'Chelsea' in teams

    def test_extract_alias_spurs(self):
        teams = extract_teams('How are Spurs doing this season?')
        assert teams == ['Tottenham']

    def test_extract_alias_forest(self):
        teams = extract_teams("What's Forest's form like?")
        assert teams == ["Nott'm Forest"]

    def test_extract_full_name(self):
        teams = extract_teams('Manchester United have been poor')
        assert teams == ['Man United']

    def test_extract_no_team(self):
        teams = extract_teams('What is the league table?')
        assert teams == []

    def test_no_partial_match(self):
        """'united' inside 'Manchester United' should not double-match."""
        teams = extract_teams('Manchester United are playing')
        assert len(teams) == 1
        assert teams[0] == 'Man United'

    def test_extract_multiple_aliases(self):
        teams = extract_teams('Spurs vs Gunners')
        assert 'Tottenham' in teams
        assert 'Arsenal' in teams


# ---------------------------------------------------------------------------
# Tests: Intent parsing
# ---------------------------------------------------------------------------

class TestIntentParsing:
    """Tests for parsing user intent from messages."""

    def test_h2h_intent(self):
        intent = parse_intent('Arsenal vs Chelsea head to head')
        assert intent.query_type == 'h2h'
        assert 'Arsenal' in intent.teams
        assert 'Chelsea' in intent.teams

    def test_form_intent(self):
        intent = parse_intent("What's Liverpool's recent form?")
        assert intent.query_type == 'form'
        assert 'Liverpool' in intent.teams

    def test_goals_intent(self):
        intent = parse_intent('How many goals has Arsenal scored?')
        assert intent.query_type == 'goals'

    def test_draws_intent(self):
        intent = parse_intent('Which teams draw the most?')
        assert intent.query_type == 'draws'

    def test_stats_intent_shots(self):
        intent = parse_intent('How many shots does Chelsea take?')
        assert intent.query_type == 'stats'
        assert intent.stat_type == 'shots'

    def test_stats_intent_corners(self):
        intent = parse_intent("Arsenal's corner stats")
        assert intent.query_type == 'stats'
        assert intent.stat_type == 'corners'

    def test_season_intent(self):
        intent = parse_intent('Show the league table this season')
        assert intent.query_type == 'season'

    def test_prediction_intent(self):
        intent = parse_intent('Will Arsenal win their next match?')
        assert intent.query_type == 'prediction'

    def test_last_n_extraction(self):
        intent = parse_intent('Arsenal last 10 matches')
        assert intent.last_n == 10

    def test_last_n_capped_at_20(self):
        intent = parse_intent('Show last 100 matches')
        assert intent.last_n == 20

    def test_season_extraction(self):
        intent = parse_intent('How did Arsenal do in 2023/24?')
        assert intent.season == '2023'

    def test_general_intent(self):
        intent = parse_intent('Tell me about Arsenal')
        assert intent.query_type == 'general'
        assert 'Arsenal' in intent.teams


# ---------------------------------------------------------------------------
# Tests: DataFrame queries
# ---------------------------------------------------------------------------

class TestDataFrameQueries:
    """Tests for querying the match DataFrame."""

    def test_h2h_query(self, sample_df):
        intent = parse_intent('Arsenal vs Chelsea head to head')
        result = query_dataframe(sample_df, intent)
        assert 'Head-to-Head' in result
        assert 'Arsenal' in result
        assert 'Chelsea' in result

    def test_form_query(self, sample_df):
        intent = parse_intent("Arsenal's recent form")
        result = query_dataframe(sample_df, intent)
        assert 'Last' in result
        assert 'Arsenal' in result
        assert 'Form:' in result

    def test_goals_query(self, sample_df):
        intent = parse_intent("Arsenal's goal stats")
        result = query_dataframe(sample_df, intent)
        assert 'Goal Stats' in result
        assert 'scored' in result
        assert 'conceded' in result

    def test_draws_query(self, sample_df):
        intent = parse_intent('Arsenal draw stats')
        result = query_dataframe(sample_df, intent)
        assert 'Draw Stats' in result

    def test_draw_trends_no_team(self, sample_df):
        intent = parse_intent('draw trends in the league')
        result = query_dataframe(sample_df, intent)
        assert 'Draw Trends' in result

    def test_stats_query_shots(self, sample_df):
        intent = parse_intent('Arsenal shots stats')
        result = query_dataframe(sample_df, intent)
        assert 'Shots' in result

    def test_stats_query_corners(self, sample_df):
        intent = parse_intent('Chelsea corner stats')
        result = query_dataframe(sample_df, intent)
        assert 'Corners' in result

    def test_stats_query_cards(self, sample_df):
        intent = parse_intent('Arsenal yellow card stats')
        result = query_dataframe(sample_df, intent)
        assert 'Cards' in result

    def test_season_table_query(self, sample_df):
        intent = parse_intent('Show the league standings')
        result = query_dataframe(sample_df, intent)
        assert 'Standings' in result
        assert 'Pts' in result

    def test_prediction_query(self, sample_df):
        intent = parse_intent('Who will win Arsenal vs Chelsea?')
        result = query_dataframe(sample_df, intent)
        # Should include both form and H2H data
        assert 'Arsenal' in result
        assert 'Chelsea' in result

    def test_general_fallback_with_teams(self, sample_df):
        """General query with teams should fall back to form data."""
        intent = parse_intent('Tell me about Arsenal')
        result = query_dataframe(sample_df, intent)
        assert 'Arsenal' in result

    def test_empty_dataframe(self):
        empty_df = pd.DataFrame()
        intent = parse_intent('Arsenal form')
        result = query_dataframe(empty_df, intent)
        assert result == ''

    def test_h2h_no_matches(self, sample_df):
        intent = QueryIntent()
        intent.query_type = 'h2h'
        intent.teams = ['Arsenal', 'Wolves']
        result = query_dataframe(sample_df, intent)
        assert 'No head-to-head data' in result


# ---------------------------------------------------------------------------
# Tests: RAG prompt builder
# ---------------------------------------------------------------------------

class TestRAGPromptBuilder:
    """Tests for the system prompt builder."""

    def test_prompt_with_data(self, sample_df):
        prompt, grounded = build_rag_prompt(sample_df, 'How is Arsenal doing?')
        assert 'Premier League Oracle' in prompt
        assert grounded is True
        assert 'RELEVANT DATA' in prompt

    def test_prompt_without_data(self):
        prompt, grounded = build_rag_prompt(None, 'Hello')
        assert 'Premier League Oracle' in prompt
        assert grounded is False
        assert 'No specific match data' in prompt

    def test_prompt_with_empty_df(self):
        empty_df = pd.DataFrame()
        prompt, grounded = build_rag_prompt(empty_df, 'Arsenal form')
        assert grounded is False

    def test_prompt_includes_match_count(self, sample_df):
        prompt, _ = build_rag_prompt(sample_df, 'Arsenal vs Chelsea')
        assert '10 historical' in prompt  # sample_df has 10 matches

    def test_prompt_no_team_general(self, sample_df):
        prompt, grounded = build_rag_prompt(sample_df, 'What is football?')
        assert 'Premier League Oracle' in prompt
        # No relevant data since no team mentioned
        assert grounded is False


# ---------------------------------------------------------------------------
# Tests: /chat/rag endpoint
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not FASTAPI_AVAILABLE, reason='fastapi not available')
class TestChatRAGEndpoint:
    """Tests for POST /chat/rag."""

    def test_400_without_api_key(self, client):
        """Should return 400 if no OpenAI API key is configured."""
        # Ensure no env var
        import app.api.main as main_module
        original_key = main_module.OPENAI_API_KEY
        main_module.OPENAI_API_KEY = ''
        try:
            response = client.post('/chat/rag', json={
                'message': 'How is Arsenal doing?',
            })
            assert response.status_code == 400
            assert 'API key' in response.json()['detail']
        finally:
            main_module.OPENAI_API_KEY = original_key

    def test_422_empty_message(self, client):
        """Should return 422 for empty message."""
        response = client.post('/chat/rag', json={'message': ''})
        assert response.status_code == 422

    def test_422_message_too_long(self, client):
        """Should return 422 for message exceeding 500 chars."""
        response = client.post('/chat/rag', json={'message': 'x' * 501})
        assert response.status_code == 422

    def test_valid_request_with_mock_openai(self, client):
        """Should return a reply when OpenAI is mocked."""
        import app.api.main as main_module

        original_key = main_module.OPENAI_API_KEY
        main_module.OPENAI_API_KEY = 'sk-test-key'

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = 'Arsenal are in great form!'

        try:
            with patch('openai.OpenAI') as mock_openai_cls:
                mock_client = MagicMock()
                mock_client.chat.completions.create.return_value = mock_response
                mock_openai_cls.return_value = mock_client

                response = client.post('/chat/rag', json={
                    'message': 'How is Arsenal doing?',
                    'conversation_history': [
                        {'role': 'user', 'content': 'Hi'},
                        {'role': 'assistant', 'content': 'Hello!'},
                    ],
                })

            assert response.status_code == 200
            data = response.json()
            assert data['reply'] == 'Arsenal are in great form!'
            assert 'grounded' in data
        finally:
            main_module.OPENAI_API_KEY = original_key

    def test_api_key_from_header(self, client):
        """Should accept API key from X-OpenAI-Key header."""
        import app.api.main as main_module

        original_key = main_module.OPENAI_API_KEY
        main_module.OPENAI_API_KEY = ''

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = 'Test reply'

        try:
            with patch('openai.OpenAI') as mock_openai_cls:
                mock_client = MagicMock()
                mock_client.chat.completions.create.return_value = mock_response
                mock_openai_cls.return_value = mock_client

                response = client.post(
                    '/chat/rag',
                    json={'message': 'Hello'},
                    headers={'X-OpenAI-Key': 'sk-user-key'},
                )

            assert response.status_code == 200
            assert response.json()['reply'] == 'Test reply'
        finally:
            main_module.OPENAI_API_KEY = original_key

    def test_conversation_history_passed(self, client):
        """Should pass conversation history to OpenAI."""
        import app.api.main as main_module

        original_key = main_module.OPENAI_API_KEY
        main_module.OPENAI_API_KEY = 'sk-test-key'

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = 'Reply'

        try:
            with patch('openai.OpenAI') as mock_openai_cls:
                mock_client = MagicMock()
                mock_client.chat.completions.create.return_value = mock_response
                mock_openai_cls.return_value = mock_client

                client.post('/chat/rag', json={
                    'message': 'And Chelsea?',
                    'conversation_history': [
                        {'role': 'user', 'content': 'How is Arsenal?'},
                        {'role': 'assistant', 'content': 'Good form!'},
                    ],
                })

                # Verify the messages sent to OpenAI include history
                call_args = mock_client.chat.completions.create.call_args
                messages = call_args.kwargs.get('messages', call_args[1].get('messages', []))
                roles = [m['role'] for m in messages]
                assert 'system' in roles
                assert roles.count('user') >= 2  # history + current
                assert 'assistant' in roles
        finally:
            main_module.OPENAI_API_KEY = original_key
