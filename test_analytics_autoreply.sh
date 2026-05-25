#!/bin/bash
# Test analytics sync and auto-reply

echo "=========================================="
echo "🧪 TESTING ANALYTICS & AUTO-REPLY"
echo "=========================================="
echo ""

WORKSPACE_ID="034533e9-1661-459a-bc0c-59ae17921499"

# Step 1: Check published content
echo "1️⃣  Checking published LinkedIn content..."
CONTENT=$(curl -s "http://localhost:8001/api/v1/content?workspace_id=$WORKSPACE_ID")

PUBLISHED_COUNT=$(echo "$CONTENT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
published = [c for c in data if c.get('status') == 'published' and c.get('platform') == 'linkedin']
print(len(published))
if published:
    for c in published:
        print(f\"  - {c.get('title', 'Untitled')}\")
        print(f\"    Post ID: {c.get('platform_post_id', 'NOT SET')}\")
" 2>/dev/null)

echo "$PUBLISHED_COUNT"
echo ""

if [ "$PUBLISHED_COUNT" = "0" ]; then
    echo "❌ No published LinkedIn content found!"
    echo "💡 You need to publish a post through Socialium first"
    echo ""
    echo "To publish:"
    echo "  1. Go to http://localhost:3000/content"
    echo "  2. Create or generate content"
    echo "  3. Schedule it or use 'Publish Now'"
    echo "  4. Wait for it to publish"
    exit 1
fi

# Step 2: Try manual analytics sync
echo "2️⃣  Syncing LinkedIn analytics..."
SYNC_RESPONSE=$(curl -s -X POST "http://localhost:8001/api/v1/analytics/sync-linkedin?workspace_id=$WORKSPACE_ID")

echo "Sync Response:"
echo "$SYNC_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SYNC_RESPONSE"
echo ""

# Step 3: Check analytics
echo "3️⃣  Checking analytics..."
ANALYTICS=$(curl -s "http://localhost:8001/api/v1/analytics/overview?workspace_id=$WORKSPACE_ID&platform=linkedin")

echo "$ANALYTICS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
summary = data.get('summary', {})
print(f\"  Total Posts: {summary.get('total_posts', 0)}\")
print(f\"  Impressions: {summary.get('total_impressions', 0)}\")
print(f\"  Likes: {summary.get('total_likes', 0)}\")
print(f\"  Comments: {summary.get('total_comments', 0)}\")
print(f\"  Shares: {summary.get('total_shares', 0)}\")
" 2>/dev/null || echo "Failed to parse analytics"
echo ""

# Step 4: Test auto-reply
echo "4️⃣  Testing auto-reply AI..."
AUTO_REPLY_TEST=$(curl -s -X POST "http://localhost:8001/api/v1/auto-reply/test?comment_text=Great%20post&platform=linkedin&tone=professional")

echo "Auto-Reply Test:"
echo "$AUTO_REPLY_TEST" | python3 -m json.tool 2>/dev/null || echo "$AUTO_REPLY_TEST"
echo ""

# Step 5: Check auto-reply stats
echo "5️⃣  Auto-reply stats..."
AUTO_REPLY_STATS=$(curl -s "http://localhost:8001/api/v1/auto-reply/stats?workspace_id=$WORKSPACE_ID")

echo "$AUTO_REPLY_STATS" | python3 -m json.tool 2>/dev/null || echo "$AUTO_REPLY_STATS"
echo ""

echo "=========================================="
echo "💡 Next Steps:"
echo "   - Analytics: http://localhost:3000/analytics"
echo "   - Auto-Reply: http://localhost:3000/auto-reply"
echo "=========================================="
