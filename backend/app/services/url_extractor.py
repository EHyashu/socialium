"""URL content extractor - fetches actual content from URLs.

Supports:
- YouTube videos (title, description, transcript)
- Blog articles (title, content, metadata)
- Generic web pages (title, description, main content)

Graceful fallback: If extraction fails, returns the URL for LLM to work with.
"""

import logging
from typing import Optional

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


async def extract_url_content(url: str) -> dict[str, str]:
    """Extract content from a URL.
    
    Args:
        url: The URL to extract content from
        
    Returns:
        Dictionary with extracted content:
        - title: Page/video title
        - description: Summary or description
        - content: Main content body (if available)
        - source_type: Type of content (youtube, article, webpage)
    """
    try:
        # YouTube videos
        if 'youtube.com' in url or 'youtu.be' in url:
            return await _extract_youtube_content(url)
        
        # Blog articles and web pages
        return await _extract_webpage_content(url)
        
    except Exception as e:
        logger.warning(f"URL extraction failed: {e}")
        # Fallback: return URL as-is
        return {
            "title": "",
            "description": f"Content from URL: {url}",
            "content": f"Create content based on this URL: {url}",
            "source_type": "url"
        }


async def _extract_youtube_content(url: str) -> dict[str, str]:
    """Extract YouTube video information using oEmbed API."""
    try:
        # YouTube oEmbed API (free, no auth required)
        oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(oembed_url)
            response.raise_for_status()
            data = response.json()
            
            return {
                "title": data.get("title", ""),
                "description": data.get("title", ""),  # oEmbed doesn't provide description
                "content": f"Create social media content about this YouTube video: {data.get('title', '')}. "
                          f"Author: {data.get('author_name', 'Unknown')}. "
                          f"Video URL: {url}",
                "source_type": "youtube"
            }
            
    except Exception as e:
        logger.warning(f"YouTube extraction failed: {e}")
        return {
            "title": "",
            "description": f"YouTube video: {url}",
            "content": f"Create content about this YouTube video: {url}",
            "source_type": "youtube"
        }


async def _extract_webpage_content(url: str) -> dict[str, str]:
    """Extract content from a webpage using web scraping."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract title
            title = ""
            if soup.title:
                title = soup.title.string.strip()
            
            # Extract meta description
            description = ""
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc and meta_desc.get('content'):
                description = meta_desc['content'].strip()
            
            # Extract main content (try multiple strategies)
            content = ""
            
            # Strategy 1: Look for article tag
            article = soup.find('article')
            if article:
                content = article.get_text(separator=' ', strip=True)
            
            # Strategy 2: Look for main content divs
            if not content:
                for selector in ['main', '[role="main"]', '.content', '.article', '.post']:
                    elem = soup.select_one(selector)
                    if elem:
                        content = elem.get_text(separator=' ', strip=True)
                        break
            
            # Strategy 3: Use body text (limit to first 2000 chars)
            if not content and soup.body:
                content = soup.body.get_text(separator=' ', strip=True)[:2000]
            
            # Clean up content (remove extra whitespace)
            content = ' '.join(content.split())
            
            return {
                "title": title,
                "description": description,
                "content": f"{title}\n\n{description}\n\n{content[:1500]}" if content else f"{title}\n\n{description}",
                "source_type": "article"
            }
            
    except Exception as e:
        logger.warning(f"Webpage extraction failed: {e}")
        return {
            "title": "",
            "description": f"Web page: {url}",
            "content": f"Create content based on this URL: {url}",
            "source_type": "webpage"
        }
