"""
Web search fallback for Oracle Chat RAG (P7h).

When the DataFrame RAG engine cannot ground a response (no matching
team/player data found), this module searches the web for current
Premier League information and injects the results into the system
prompt so the LLM can reference real, up-to-date data instead of
hallucinating statistics from its training corpus.

Uses DuckDuckGo (no API key required, BSD-licensed library).
Degrades gracefully — if the search fails or the library is
unavailable, the chat endpoint falls back silently to the existing
ungrounded behaviour.
"""

import logging
import time
from dataclasses import dataclass
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Optional dependency — feature disabled if not installed
try:
    from duckduckgo_search import DDGS
    WEB_SEARCH_AVAILABLE = True
except ImportError:
    DDGS = None  # type: ignore[assignment, misc]
    WEB_SEARCH_AVAILABLE = False
    logger.info("duckduckgo-search not installed — web search fallback disabled")

# ---------------------------------------------------------------------------
# In-memory TTL cache (mirrors _rate_limit_store pattern in main.py)
# ---------------------------------------------------------------------------

_CACHE_TTL = 900  # 15 minutes
_CACHE_MAX = 100  # max entries before eviction
_search_cache: dict[str, tuple[float, list["SearchResult"]]] = {}


@dataclass(frozen=True)
class SearchResult:
    """A single web search result."""
    title: str
    source: str  # domain only (e.g. "bbc.co.uk")
    snippet: str


def _cache_get(key: str) -> list[SearchResult] | None:
    """Get a cached result if it exists and hasn't expired."""
    entry = _search_cache.get(key)
    if entry is None:
        return None
    timestamp, results = entry
    if time.time() - timestamp > _CACHE_TTL:
        del _search_cache[key]
        return None
    return results


def _cache_set(key: str, results: list[SearchResult]) -> None:
    """Store a result in the cache, evicting oldest if at capacity."""
    if len(_search_cache) >= _CACHE_MAX:
        oldest_key = min(_search_cache, key=lambda k: _search_cache[k][0])
        del _search_cache[oldest_key]
    _search_cache[key] = (time.time(), results)


# ---------------------------------------------------------------------------
# Search function
# ---------------------------------------------------------------------------

def search_premier_league(query: str, max_results: int = 3) -> list[SearchResult]:
    """Search the web for current Premier League information.

    Prefixes the query with "Premier League" to scope results.
    Returns up to `max_results` SearchResult objects.

    This is a synchronous function (DuckDuckGo library is sync).
    Call from async code via asyncio.to_thread() or run_in_executor().

    Returns an empty list on any failure — never raises.
    """
    if not WEB_SEARCH_AVAILABLE or DDGS is None:
        return []

    # Normalise for cache key
    cache_key = query.strip().lower()
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.debug("Web search cache hit for: %s", cache_key)
        return cached

    try:
        # Scope to Premier League content
        search_query = f"Premier League {query}"
        raw_results = DDGS().text(search_query, max_results=max_results)

        results: list[SearchResult] = []
        for item in raw_results:
            title = item.get("title", "").strip()
            href = item.get("href", "")
            body = item.get("body", "").strip()

            # Extract domain from URL
            try:
                domain = urlparse(href).netloc
                # Strip "www." prefix for cleaner display
                if domain.startswith("www."):
                    domain = domain[4:]
            except Exception:
                domain = href[:50]

            # Truncate snippet to keep prompt size reasonable
            snippet = body[:300] if body else ""

            if title and snippet:
                results.append(SearchResult(
                    title=title,
                    source=domain,
                    snippet=snippet,
                ))

        _cache_set(cache_key, results)
        logger.info("Web search returned %d results for: %s", len(results), query)
        return results

    except Exception as e:
        logger.warning("Web search failed for '%s': %s", query, e)
        return []


# ---------------------------------------------------------------------------
# Prompt injection
# ---------------------------------------------------------------------------

def inject_search_context(system_prompt: str, results: list[SearchResult]) -> str:
    """Append web search results to the system prompt.

    Replaces the "No specific match data" fallback paragraph with
    web search results so the LLM has current information to reference.
    """
    if not results:
        return system_prompt

    # Remove the ungrounded fallback text if present
    fallback_text = (
        "No specific match data was retrieved for this query. "
        "Provide general Premier League analysis based on your knowledge, "
        "but note that you are not referencing specific match data.\n"
    )
    system_prompt = system_prompt.replace(fallback_text, "")

    # Build search context section
    lines = [
        "WEB SEARCH RESULTS (live data — may be more current than your training data):\n"
    ]
    for i, result in enumerate(results, 1):
        lines.append(f"{i}. {result.title}")
        lines.append(f"   Source: {result.source}")
        lines.append(f"   {result.snippet}")
        lines.append("")

    lines.append(
        "Use these search results to inform your response. "
        "Cite sources when referencing specific claims. "
        "Do not invent statistics that aren't in the search results above.\n"
    )

    system_prompt += "\n".join(lines)
    return system_prompt
