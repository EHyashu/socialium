from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.services.viral_scoring_service import ViralScoringService, ViralScoreResult

@pytest.fixture
def scoring_service() -> ViralScoringService:
    """Provide an instance of the ViralScoringService."""
    return ViralScoringService()

def test_score_to_probability(scoring_service):
    """Verify that numeric scores are correctly converted to probability text."""
    assert scoring_service._score_to_probability(90) == "Very High"
    assert scoring_service._score_to_probability(70) == "High"
    assert scoring_service._score_to_probability(55) == "Medium"
    assert scoring_service._score_to_probability(40) == "Low"
    assert scoring_service._score_to_probability(20) == "Very Low"

def test_score_emotional_triggers(scoring_service):
    """Verify that high-viral emotion keywords trigger correct scoring."""
    # Test neutral content (no emotions)
    assert scoring_service._score_emotional_triggers("Just a simple statement about database config.") == 0
    
    # Test content with awe triggers (incredible)
    assert scoring_service._score_emotional_triggers("This is incredible!") == 4
    
    # Test content with multiple emotions (anger + anxiety + curiosity)
    angry_anxious_curious = "This is a wrong and broken approach. Stop now! Here is the secret truth."
    score = scoring_service._score_emotional_triggers(angry_anxious_curious)
    assert score > 4  # Should receive emotional variety bonuses

def test_score_algorithm_fit(scoring_service):
    """Verify platform specific formatting checks (length, hashtag count)."""
    # Test LinkedIn fit (prefers 3-5 hashtags, 600-1200 chars)
    linkedin_post = "insights lessons growth " * 30  # ~720 chars
    hashtags = ["#marketing", "#business", "#tech"]
    score = scoring_service._score_algorithm_fit("linkedin", linkedin_post, hashtags)
    assert score > 5  # Good length + good hashtags count
    
    # Test Twitter fit (needs to be short, 1-3 hashtags)
    tweet = "Unpopular opinion: manual testing is dead. Here's why."
    tweet_hashtags = ["#testing"]
    score = scoring_service._score_algorithm_fit("twitter", tweet, tweet_hashtags)
    assert score > 5

def test_generate_recommendation(scoring_service):
    """Verify that actionable recommendations highlight the weakest factor."""
    scores = {
        "hook": 18,
        "emotion": 2,  # Weakest
        "trend": 15,
        "historical": 12,
        "uniqueness": 10,
        "algorithm": 9
    }
    rec = scoring_service._generate_recommendation(scores, "linkedin")
    assert "emotional trigger" in rec.lower()

@pytest.mark.asyncio
@patch("app.services.viral_scoring_service.get_openai_client")
@patch("app.services.viral_scoring_service.qdrant_search")
@patch("app.services.viral_scoring_service._set_cached_score")
@patch("app.services.viral_scoring_service._get_cached_score")
async def test_score_content_flow(
    mock_get_cached, mock_set_cached, mock_qdrant, mock_get_openai, scoring_service
):
    """Test the complete score_content method with mocked external APIs."""
    # Setup mocks
    mock_get_cached.return_value = None  # Cache miss
    mock_set_cached.return_value = None
    mock_qdrant.return_value = [{"id": 1, "score": 0.8, "payload": {}}]
    
    # Mock OpenAI Completion API
    mock_openai_client = MagicMock()
    mock_chat_completion = AsyncMock()
    mock_chat_completion.choices = [
        MagicMock(message=MagicMock(content="15"))  # Hook score response
    ]
    mock_openai_client.chat.completions.create = AsyncMock(return_value=mock_chat_completion)
    mock_get_openai.return_value = mock_openai_client
    
    # Run content scoring
    result = await scoring_service.score_content(
        draft_id="00000000-0000-0000-0000-000000000000",
        workspace_id="00000000-0000-0000-0000-000000000000",
        platform="linkedin",
        content="This is a test post with amazing lessons and insights.",
        hashtags=["#test"],
    )
    
    assert isinstance(result, ViralScoreResult)
    assert result.total_score > 0
    assert "hook" in result.breakdown
    assert "historical" in result.breakdown
    assert mock_get_openai.called
    assert mock_qdrant.called
