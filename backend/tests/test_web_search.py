"""
Tests for the web search fallback module (P7h).

Validates:
- SearchResult dataclass creation
- search_premier_league() returns results and handles failures
- In-memory TTL cache behaviour (hits, misses, expiry, eviction)
- inject_search_context() prompt formatting
- Graceful degradation when duckduckgo-search is unavailable
- Integration with main.py /chat/rag endpoint (mocked search)
"""

import os
import sys
import time
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.api.web_search import (
    _CACHE_TTL,
    SearchResult,
    _cache_get,
    _cache_set,
    _search_cache,
    inject_search_context,
    search_premier_league,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _clear_cache():
    """Clear search cache before each test."""
    _search_cache.clear()
    yield
    _search_cache.clear()


def _make_ddgs_result(
    title: str = "Arsenal beat Chelsea 3-1",
    href: str = "https://www.bbc.co.uk/sport/football/12345",
    body: str = "Arsenal secured a comprehensive 3-1 victory over Chelsea at the Emirates.",
) -> dict[str, str]:
    """Create a mock DuckDuckGo search result dict."""
    return {"title": title, "href": href, "body": body}


# ---------------------------------------------------------------------------
# SearchResult dataclass
# ---------------------------------------------------------------------------

class TestSearchResult:
    """Tests for the SearchResult dataclass."""

    def test_creation(self):
        result = SearchResult(title="Test", source="bbc.co.uk", snippet="Some text")
        assert result.title == "Test"
        assert result.source == "bbc.co.uk"
        assert result.snippet == "Some text"

    def test_frozen(self):
        result = SearchResult(title="Test", source="bbc.co.uk", snippet="Some text")
        with pytest.raises(AttributeError):
            result.title = "Changed"  # type: ignore[misc]

    def test_equality(self):
        r1 = SearchResult(title="A", source="b", snippet="c")
        r2 = SearchResult(title="A", source="b", snippet="c")
        assert r1 == r2


# ---------------------------------------------------------------------------
# Cache behaviour
# ---------------------------------------------------------------------------

class TestCache:
    """Tests for the in-memory TTL cache."""

    def test_set_and_get(self):
        results = [SearchResult(title="A", source="b.com", snippet="c")]
        _cache_set("test query", results)
        cached = _cache_get("test query")
        assert cached is not None
        assert len(cached) == 1
        assert cached[0].title == "A"

    def test_cache_miss(self):
        assert _cache_get("nonexistent") is None

    def test_cache_expiry(self):
        results = [SearchResult(title="A", source="b.com", snippet="c")]
        _cache_set("expired", results)
        # Manually expire the entry
        _search_cache["expired"] = (time.time() - _CACHE_TTL - 1, results)
        assert _cache_get("expired") is None
        assert "expired" not in _search_cache  # cleaned up

    def test_cache_eviction_at_max(self):
        """When cache is at capacity, oldest entry is evicted."""
        # Fill cache to max
        for i in range(100):
            _cache_set(f"query_{i}", [SearchResult(title=f"R{i}", source="x", snippet="y")])
            # Stagger timestamps slightly so there's a clear oldest
            _search_cache[f"query_{i}"] = (
                time.time() - (100 - i),
                _search_cache[f"query_{i}"][1],
            )

        assert len(_search_cache) == 100

        # Add one more — should evict the oldest (query_0 with lowest timestamp)
        _cache_set("new_query", [SearchResult(title="New", source="z", snippet="w")])
        assert len(_search_cache) == 100
        assert "new_query" in _search_cache
        assert "query_0" not in _search_cache


# ---------------------------------------------------------------------------
# search_premier_league()
# ---------------------------------------------------------------------------

class TestSearchPremierLeague:
    """Tests for the main search function."""

    @patch("app.api.web_search.DDGS")
    def test_returns_results(self, mock_ddgs_cls):
        """Successful search returns SearchResult list."""
        mock_instance = MagicMock()
        mock_instance.text.return_value = [
            _make_ddgs_result(),
            _make_ddgs_result(
                title="Premier League standings",
                href="https://premierleague.com/tables",
                body="Current Premier League standings for 2025/26 season.",
            ),
        ]
        mock_ddgs_cls.return_value = mock_instance

        results = search_premier_league("Arsenal form")
        assert len(results) == 2
        assert results[0].title == "Arsenal beat Chelsea 3-1"
        assert results[0].source == "bbc.co.uk"
        assert "3-1 victory" in results[0].snippet

    @patch("app.api.web_search.DDGS")
    def test_scopes_query_to_premier_league(self, mock_ddgs_cls):
        """Search query is prefixed with 'Premier League'."""
        mock_instance = MagicMock()
        mock_instance.text.return_value = []
        mock_ddgs_cls.return_value = mock_instance

        search_premier_league("Arsenal form")
        mock_instance.text.assert_called_once_with(
            "Premier League Arsenal form", max_results=3,
        )

    @patch("app.api.web_search.DDGS")
    def test_custom_max_results(self, mock_ddgs_cls):
        """max_results parameter is passed through."""
        mock_instance = MagicMock()
        mock_instance.text.return_value = []
        mock_ddgs_cls.return_value = mock_instance

        search_premier_league("test", max_results=5)
        mock_instance.text.assert_called_once_with(
            "Premier League test", max_results=5,
        )

    @patch("app.api.web_search.DDGS")
    def test_strips_www_from_domain(self, mock_ddgs_cls):
        """www. prefix is removed from source domain."""
        mock_instance = MagicMock()
        mock_instance.text.return_value = [
            _make_ddgs_result(href="https://www.skysports.com/football"),
        ]
        mock_ddgs_cls.return_value = mock_instance

        results = search_premier_league("test")
        assert results[0].source == "skysports.com"

    @patch("app.api.web_search.DDGS")
    def test_truncates_long_snippets(self, mock_ddgs_cls):
        """Snippets longer than 300 chars are truncated."""
        long_body = "A" * 500
        mock_instance = MagicMock()
        mock_instance.text.return_value = [
            _make_ddgs_result(body=long_body),
        ]
        mock_ddgs_cls.return_value = mock_instance

        results = search_premier_league("test")
        assert len(results[0].snippet) == 300

    @patch("app.api.web_search.DDGS")
    def test_skips_results_without_title_or_body(self, mock_ddgs_cls):
        """Results missing title or body are filtered out."""
        mock_instance = MagicMock()
        mock_instance.text.return_value = [
            {"title": "", "href": "https://x.com", "body": "Some text"},
            {"title": "Good", "href": "https://x.com", "body": ""},
            _make_ddgs_result(),
        ]
        mock_ddgs_cls.return_value = mock_instance

        results = search_premier_league("test")
        assert len(results) == 1
        assert results[0].title == "Arsenal beat Chelsea 3-1"

    @patch("app.api.web_search.DDGS")
    def test_returns_empty_on_exception(self, mock_ddgs_cls):
        """Search failure returns empty list, never raises."""
        mock_instance = MagicMock()
        mock_instance.text.side_effect = Exception("Network timeout")
        mock_ddgs_cls.return_value = mock_instance

        results = search_premier_league("test")
        assert results == []

    @patch("app.api.web_search.DDGS")
    def test_cache_hit_avoids_search(self, mock_ddgs_cls):
        """Repeated query with same text uses cache, not DDGS."""
        mock_instance = MagicMock()
        mock_instance.text.return_value = [_make_ddgs_result()]
        mock_ddgs_cls.return_value = mock_instance

        # First call — hits DDGS
        results1 = search_premier_league("Arsenal form")
        assert len(results1) == 1
        assert mock_instance.text.call_count == 1

        # Second call — hits cache
        results2 = search_premier_league("Arsenal form")
        assert len(results2) == 1
        assert mock_instance.text.call_count == 1  # not called again

    @patch("app.api.web_search.DDGS")
    def test_cache_key_is_case_insensitive(self, mock_ddgs_cls):
        """Cache normalises query to lowercase."""
        mock_instance = MagicMock()
        mock_instance.text.return_value = [_make_ddgs_result()]
        mock_ddgs_cls.return_value = mock_instance

        search_premier_league("Arsenal Form")
        search_premier_league("arsenal form")
        assert mock_instance.text.call_count == 1

    def test_returns_empty_when_ddgs_unavailable(self):
        """When WEB_SEARCH_AVAILABLE is False, returns empty list."""
        with patch("app.api.web_search.WEB_SEARCH_AVAILABLE", False):
            results = search_premier_league("test")
            assert results == []


# ---------------------------------------------------------------------------
# inject_search_context()
# ---------------------------------------------------------------------------

class TestInjectSearchContext:
    """Tests for prompt injection of search results."""

    def test_appends_search_results(self):
        """Search results are appended to the system prompt."""
        prompt = "You are the Premier League Oracle.\n"
        results = [
            SearchResult(
                title="Arsenal top of the league",
                source="bbc.co.uk",
                snippet="Arsenal have moved to the top of the table.",
            ),
        ]
        new_prompt = inject_search_context(prompt, results)
        assert "WEB SEARCH RESULTS" in new_prompt
        assert "Arsenal top of the league" in new_prompt
        assert "bbc.co.uk" in new_prompt
        assert "Arsenal have moved to the top" in new_prompt
        assert "Cite sources" in new_prompt

    def test_removes_fallback_text(self):
        """The ungrounded fallback paragraph is replaced."""
        prompt = (
            "You are the Oracle.\n"
            "No specific match data was retrieved for this query. "
            "Provide general Premier League analysis based on your knowledge, "
            "but note that you are not referencing specific match data.\n"
        )
        results = [SearchResult(title="T", source="s", snippet="Body text")]
        new_prompt = inject_search_context(prompt, results)
        assert "No specific match data was retrieved" not in new_prompt
        assert "WEB SEARCH RESULTS" in new_prompt

    def test_numbers_multiple_results(self):
        """Multiple results are numbered sequentially."""
        results = [
            SearchResult(title=f"Result {i}", source=f"site{i}.com", snippet=f"Text {i}")
            for i in range(3)
        ]
        new_prompt = inject_search_context("Base prompt.\n", results)
        assert "1. Result 0" in new_prompt
        assert "2. Result 1" in new_prompt
        assert "3. Result 2" in new_prompt

    def test_returns_unchanged_on_empty_results(self):
        """Empty results list returns prompt unchanged."""
        prompt = "Original prompt."
        assert inject_search_context(prompt, []) == prompt

    def test_preserves_existing_prompt_content(self):
        """Original prompt content is preserved when injecting."""
        prompt = "You are the Oracle.\nYou have 2191 matches.\n"
        results = [SearchResult(title="T", source="s", snippet="Body")]
        new_prompt = inject_search_context(prompt, results)
        assert "You are the Oracle." in new_prompt
        assert "You have 2191 matches." in new_prompt
