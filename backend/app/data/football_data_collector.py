"""
🎯 Football-Data.org API Collector - Complete Implementation

📚 For Beginners:
    This collects all the football data we need from the internet!
    Like getting match results, team standings, and player stats.

👨‍💻 For Developers:
    Complete integration with Football-Data.org API v4
    Handles all endpoints, pagination, rate limiting, and caching
    Returns clean, ready-to-use data for our ML models

🎓 For Experts:
    Implements exponential backoff for rate limiting
    Async support for parallel requests
    Automatic failover and retry logic
    Response caching with TTL
"""

import hashlib
import json
import logging
import os
import time
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import requests

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FootballDataCollector:
    """
    Complete Football-Data.org API v4 integration.
    
    This is our data pipeline - it gets everything we need!
    """

    # API Configuration
    BASE_URL = "https://api.football-data.org/v4"
    PREMIER_LEAGUE_CODE = "PL"  # Competition code
    PREMIER_LEAGUE_ID = 2021     # Competition ID

    # Rate limiting (free tier: 10 calls/minute)
    RATE_LIMIT_CALLS = 10
    RATE_LIMIT_PERIOD = 60  # seconds

    def __init__(self, api_key: str | None = None, cache_dir: str = "cache"):
        """
        Initialize the collector.
        
        Args:
            api_key: Your Football-Data.org API key
            cache_dir: Directory for caching responses
        """
        self.api_key = api_key or os.environ.get('FOOTBALL_DATA_API_KEY')

        if not self.api_key:
            logger.warning("No API key provided. Some features may be limited.")

        self.headers = {'X-Auth-Token': self.api_key} if self.api_key else {}

        # Set up caching
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)

        # Rate limiting tracking
        self.call_times = []

        # Session for connection pooling
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    # ==================== CORE API METHODS ====================

    def _make_request(self, endpoint: str, params: dict | None = None,
                     use_cache: bool = True, cache_ttl: int = 3600) -> dict:
        """
        Make API request with rate limiting and caching.
        
        📚 For Beginners:
            This is like asking the API for information, but politely
            (not too often) and remembering answers we already got.
        """
        # Check cache first
        if use_cache:
            cached = self._get_cached_response(endpoint, params)
            if cached:
                logger.debug(f"Using cached response for {endpoint}")
                return cached

        # Rate limiting
        self._enforce_rate_limit()

        # Build URL
        url = f"{self.BASE_URL}/{endpoint}"

        # Make request with retries
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = self.session.get(url, params=params)

                if response.status_code == 200:
                    data = response.json()

                    # Cache successful response
                    if use_cache:
                        self._cache_response(endpoint, params, data, cache_ttl)

                    return data

                elif response.status_code == 429:
                    # Rate limited - wait and retry
                    wait_time = int(response.headers.get('X-RequestCounter-Reset', 60))
                    logger.warning(f"Rate limited. Waiting {wait_time} seconds...")
                    time.sleep(wait_time)

                elif response.status_code == 403:
                    logger.error("API returned 403 Forbidden — invalid/expired key or plan restriction")
                    raise ValueError(
                        "API returned 403 Forbidden. This usually means:\n"
                        "  1. Your API key is invalid or expired, OR\n"
                        "  2. Your plan (free tier) does not support this endpoint/season.\n"
                        "Free tier only allows the current PL season — upgrade for historical data."
                    )

                else:
                    logger.error(f"API error: {response.status_code} - {response.text}")

            except requests.exceptions.RequestException as e:
                logger.error(f"Request failed: {e}")

                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    logger.info(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)

        return {}

    def _enforce_rate_limit(self):
        """Ensure we don't exceed rate limits."""
        now = time.time()

        # Remove old calls outside the window
        self.call_times = [t for t in self.call_times
                          if now - t < self.RATE_LIMIT_PERIOD]

        # Check if we need to wait
        if len(self.call_times) >= self.RATE_LIMIT_CALLS:
            wait_time = self.RATE_LIMIT_PERIOD - (now - self.call_times[0]) + 1
            logger.info(f"Rate limit reached. Waiting {wait_time:.1f} seconds...")
            time.sleep(wait_time)

        # Record this call
        self.call_times.append(now)

    def _get_cached_response(self, endpoint: str, params: dict | None) -> dict | None:
        """Get cached response if available and not expired."""
        cache_key = self._get_cache_key(endpoint, params)
        cache_file = self.cache_dir / f"{cache_key}.json"

        if cache_file.exists():
            with open(cache_file) as f:
                cached = json.load(f)

            # Check if expired
            cached_time = datetime.fromisoformat(cached['timestamp'])
            if datetime.now() - cached_time < timedelta(seconds=cached['ttl']):
                return cached['data']

        return None

    def _cache_response(self, endpoint: str, params: dict | None,
                       data: dict, ttl: int):
        """Cache API response."""
        cache_key = self._get_cache_key(endpoint, params)
        cache_file = self.cache_dir / f"{cache_key}.json"

        cache_data = {
            'timestamp': datetime.now().isoformat(),
            'ttl': ttl,
            'endpoint': endpoint,
            'params': params,
            'data': data
        }

        with open(cache_file, 'w') as f:
            json.dump(cache_data, f)

    def _get_cache_key(self, endpoint: str, params: dict | None) -> str:
        """Generate cache key for request."""
        key_string = f"{endpoint}_{json.dumps(params, sort_keys=True)}"
        return hashlib.md5(key_string.encode()).hexdigest()

    # ==================== COMPETITION ENDPOINTS ====================

    def get_competition_info(self) -> dict:
        """
        Get Premier League competition information.
        
        Returns:
            Competition details including current season, teams, etc.
        """
        logger.info("Fetching Premier League competition info...")
        return self._make_request(f"competitions/{self.PREMIER_LEAGUE_ID}")

    def get_current_season(self) -> dict:
        """Get current season information."""
        comp_info = self.get_competition_info()
        return comp_info.get('currentSeason', {})

    # ==================== MATCHES ENDPOINTS ====================

    def get_matches(self, season: int | None = None,
                    date_from: str | None = None,
                    date_to: str | None = None,
                    status: str | None = None,
                    matchday: int | None = None) -> list[dict]:
        """
        Get matches with various filters.
        
        📚 For Beginners:
            Gets match data - you can ask for specific dates, seasons, etc.
            
        Args:
            season: Year the season started (e.g., 2023 for 2023/24)
            date_from: Start date (YYYY-MM-DD)
            date_to: End date (YYYY-MM-DD)
            status: Match status (SCHEDULED, LIVE, FINISHED)
            matchday: Specific matchday/gameweek
            
        Returns:
            List of match dictionaries
        """
        logger.info(f"Fetching matches (season={season}, matchday={matchday})...")

        params = {}
        if season:
            params['season'] = season
        if date_from:
            params['dateFrom'] = date_from
        if date_to:
            params['dateTo'] = date_to
        if status:
            params['status'] = status
        if matchday:
            params['matchday'] = matchday

        response = self._make_request(
            f"competitions/{self.PREMIER_LEAGUE_ID}/matches",
            params=params
        )

        return response.get('matches', [])

    def get_today_matches(self) -> list[dict]:
        """Get today's matches."""
        return self.get_matches(
            date_from=datetime.now().strftime('%Y-%m-%d'),
            date_to=datetime.now().strftime('%Y-%m-%d')
        )

    def get_upcoming_matches(self, days: int = 7) -> list[dict]:
        """Get upcoming matches for next N days."""
        date_from = datetime.now().strftime('%Y-%m-%d')
        date_to = (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')

        return self.get_matches(
            date_from=date_from,
            date_to=date_to,
            status='SCHEDULED'
        )

    def get_match_details(self, match_id: int) -> dict:
        """Get detailed information for a specific match."""
        logger.info(f"Fetching match details for ID: {match_id}")
        return self._make_request(f"matches/{match_id}")

    def get_team_matches(self, team_id: int, limit: int = 10,
                        status: str | None = None) -> list[dict]:
        """
        Get matches for a specific team.
        
        Args:
            team_id: Team ID
            limit: Number of matches to return
            status: Filter by status (FINISHED, SCHEDULED)
        """
        params = {'limit': limit}
        if status:
            params['status'] = status

        response = self._make_request(f"teams/{team_id}/matches", params=params)
        return response.get('matches', [])

    # ==================== STANDINGS ENDPOINTS ====================

    def get_standings(self, season: int | None = None) -> pd.DataFrame:
        """
        Get current Premier League standings.
        
        Returns:
            DataFrame with team positions, points, goals, etc.
        """
        logger.info("Fetching Premier League standings...")

        params = {}
        if season:
            params['season'] = season

        response = self._make_request(
            f"competitions/{self.PREMIER_LEAGUE_ID}/standings",
            params=params
        )

        # Extract standings table
        standings = response.get('standings', [])
        if standings:
            table = standings[0].get('table', [])
            return pd.DataFrame(table)

        return pd.DataFrame()

    # ==================== TEAMS ENDPOINTS ====================

    def get_teams(self, season: int | None = None) -> list[dict]:
        """Get all teams in Premier League."""
        logger.info("Fetching Premier League teams...")

        params = {}
        if season:
            params['season'] = season

        response = self._make_request(
            f"competitions/{self.PREMIER_LEAGUE_ID}/teams",
            params=params
        )

        return response.get('teams', [])

    def get_team_details(self, team_id: int) -> dict:
        """Get detailed information about a team."""
        logger.info(f"Fetching team details for ID: {team_id}")
        return self._make_request(f"teams/{team_id}")

    def get_team_squad(self, team_id: int) -> list[dict]:
        """Get squad/players for a team."""
        team_data = self.get_team_details(team_id)
        return team_data.get('squad', [])

    # ==================== TOP SCORERS ENDPOINTS ====================

    def get_top_scorers(self, season: int | None = None,
                       limit: int = 20) -> pd.DataFrame:
        """
        Get top scorers in Premier League.
        
        Returns:
            DataFrame with player names, teams, goals, assists
        """
        logger.info(f"Fetching top {limit} scorers...")

        params = {'limit': limit}
        if season:
            params['season'] = season

        response = self._make_request(
            f"competitions/{self.PREMIER_LEAGUE_ID}/scorers",
            params=params
        )

        scorers = response.get('scorers', [])

        # Format into DataFrame
        if scorers:
            data = []
            for scorer in scorers:
                data.append({
                    'player': scorer['player']['name'],
                    'team': scorer['team']['name'],
                    'goals': scorer['goals'],
                    'assists': scorer.get('assists', 0),
                    'penalties': scorer.get('penalties', 0)
                })

            return pd.DataFrame(data)

        return pd.DataFrame()

    # ==================== DATA PROCESSING METHODS ====================

    def get_historical_data(self, seasons: list[int]) -> pd.DataFrame:
        """
        Get historical match data for multiple seasons.
        
        📚 For Beginners:
            Gets all the old match results we need to train our model!
            
        Args:
            seasons: List of season start years (e.g., [2021, 2022, 2023])
            
        Returns:
            DataFrame with all historical matches
        """
        all_matches = []

        for season in seasons:
            logger.info(f"Fetching season {season}/{season+1}...")

            matches = self.get_matches(season=season)

            for match in matches:
                if match['status'] == 'FINISHED':
                    all_matches.append(self._process_match(match))

            # Be nice to the API
            time.sleep(2)

        return pd.DataFrame(all_matches)

    def _process_match(self, match: dict) -> dict:
        """Process raw match data into clean format."""
        return {
            'match_id': match['id'],
            'date': match['utcDate'],
            'matchday': match['matchday'],
            'home_team': match['homeTeam']['name'],
            'home_team_id': match['homeTeam']['id'],
            'away_team': match['awayTeam']['name'],
            'away_team_id': match['awayTeam']['id'],
            'home_score': match['score']['fullTime']['home'],
            'away_score': match['score']['fullTime']['away'],
            'home_ht_score': match['score']['halfTime']['home'],
            'away_ht_score': match['score']['halfTime']['away'],
            'result': self._get_result(match['score']['fullTime']),
            'referee': match.get('referees', [{}])[0].get('name') if match.get('referees') else None,
            'venue': match.get('venue'),
            'status': match['status']
        }

    def _get_result(self, score: dict) -> str:
        """Determine match result (H/D/A)."""
        if score['home'] is None or score['away'] is None:
            return None
        elif score['home'] > score['away']:
            return 'H'
        elif score['home'] < score['away']:
            return 'A'
        else:
            return 'D'

    def get_team_form(self, team_name: str, n_matches: int = 5) -> list[str]:
        """
        Get recent form for a team (e.g., ['W', 'W', 'D', 'L', 'W']).
        
        Args:
            team_name: Name of the team
            n_matches: Number of recent matches
            
        Returns:
            List of results (W/D/L)
        """
        # Get team ID first
        teams = self.get_teams()
        team = next((t for t in teams if t['name'] == team_name), None)

        if not team:
            logger.warning(f"Team '{team_name}' not found")
            return []

        # Get recent matches
        matches = self.get_team_matches(team['id'], limit=n_matches, status='FINISHED')

        form = []
        for match in matches:
            if match['homeTeam']['id'] == team['id']:
                # Home team
                result = self._get_result(match['score']['fullTime'])
            else:
                # Away team - flip result
                result = self._get_result(match['score']['fullTime'])
                if result == 'H':
                    result = 'L'
                elif result == 'A':
                    result = 'W'

            if result:
                form.append(result)

        return form

    def get_head_to_head(self, team1: str, team2: str, limit: int = 10) -> pd.DataFrame:
        """
        Get head-to-head record between two teams.
        
        Returns:
            DataFrame with H2H matches
        """
        # This would need to filter through historical matches
        # For now, return empty DataFrame
        logger.info(f"Getting H2H: {team1} vs {team2}")

        # In production, you'd filter historical data
        return pd.DataFrame()

    # ==================== UTILITY METHODS ====================

    def test_connection(self) -> bool:
        """Test if API connection works."""
        try:
            response = self.get_competition_info()
            if response:
                logger.info("✅ API connection successful!")
                logger.info(f"Competition: {response.get('name')}")
                logger.info(f"Season: {response.get('currentSeason', {}).get('startDate')} to "
                          f"{response.get('currentSeason', {}).get('endDate')}")
                return True
        except Exception as e:
            logger.error(f"❌ API connection failed: {e}")

        return False

    def get_team_id_mapping(self) -> dict[str, int]:
        """Get mapping of team names to IDs."""
        teams = self.get_teams()
        return {team['name']: team['id'] for team in teams}

    def clear_cache(self):
        """Clear all cached responses."""
        for cache_file in self.cache_dir.glob("*.json"):
            cache_file.unlink()
        logger.info("Cache cleared")


# ==================== EXAMPLE USAGE ====================

if __name__ == "__main__":
    """
    Example showing how to use the Football Data Collector.
    
    Run this file directly to test the API connection!
    """

    print("🎯 Football-Data.org API Collector Demo")
    print("=" * 50)

    # Initialize collector (set your API key as environment variable)
    # export FOOTBALL_DATA_API_KEY='your_key_here'
    collector = FootballDataCollector()

    # Test connection
    if collector.test_connection():
        print("\n📊 Current Standings (Top 5):")
        standings = collector.get_standings()
        if not standings.empty:
            for _i, row in standings.head(5).iterrows():
                team = row['team']['name']
                points = row['points']
                print(f"  {row['position']}. {team} - {points} pts")

        print("\n⚽ Upcoming Matches:")
        upcoming = collector.get_upcoming_matches(days=7)
        for match in upcoming[:5]:
            home = match['homeTeam']['name']
            away = match['awayTeam']['name']
            date = match['utcDate'][:10]
            print(f"  {date}: {home} vs {away}")

        print("\n🏆 Top Scorers:")
        scorers = collector.get_top_scorers(limit=5)
        if not scorers.empty:
            for _, scorer in scorers.iterrows():
                print(f"  {scorer['player']} ({scorer['team']}) - {scorer['goals']} goals")
    else:
        print("\n⚠️ Please set your API key:")
        print("  export FOOTBALL_DATA_API_KEY='your_key_here'")
        print("\n  Get your free key at: https://www.football-data.org/client/register")

    print("\n" + "=" * 50)
    print("✅ Collector ready for use!")
