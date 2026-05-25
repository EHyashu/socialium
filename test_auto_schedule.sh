#!/bin/bash
# Test the auto-schedule API endpoint

echo "=========================================="
echo "🧪 TESTING AUTO-SCHEDULE API"
echo "=========================================="
echo ""

# First, get list of content
echo "1️⃣  Fetching content list..."
CONTENT_RESPONSE=$(curl -s "http://localhost:8001/api/v1/content?workspace_id=034533e9-1661-459a-bc0c-59ae17921499")

# Extract first draft/approved content ID
CONTENT_ID=$(echo "$CONTENT_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data:
    if c['status'] in ['draft', 'approved']:
        print(c['id'])
        break
" 2>/dev/null)

if [ -z "$CONTENT_ID" ]; then
    echo "❌ No draft/approved content found!"
    echo ""
    echo "Available content:"
    echo "$CONTENT_RESPONSE" | python3 -m json.tool 2>/dev/null | head -30
    exit 1
fi

echo "✅ Found content: $CONTENT_ID"
echo ""

# Get content details
echo "2️⃣  Content details:"
echo "$CONTENT_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data:
    if c['id'] == '$CONTENT_ID':
        print(f\"   Title: {c.get('title', 'Untitled')}\")
        print(f\"   Status: {c['status']}\")
        print(f\"   Platform: {c.get('platform', 'N/A')}\")
        print(f\"   Scheduled At: {c.get('scheduled_at', 'Not set')}\")
        break
" 2>/dev/null
echo ""

# Call auto-schedule
echo "3️⃣  Calling auto-schedule API..."
SCHEDULE_RESPONSE=$(curl -s -X POST "http://localhost:8001/api/v1/scheduling/$CONTENT_ID/auto-schedule?workspace_id=034533e9-1661-459a-bc0c-59ae17921499")

echo "Response:"
echo "$SCHEDULE_RESPONSE" | python3 -m json.tool 2>/dev/null | head -40
echo ""

# Check if scheduled
echo "4️⃣  Verifying content was scheduled..."
VERIFY_RESPONSE=$(curl -s "http://localhost:8001/api/v1/content?workspace_id=034533e9-1661-459a-bc0c-59ae17921499")

echo "$VERIFY_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data:
    if c['id'] == '$CONTENT_ID':
        print(f\"   Status: {c['status']}\")
        print(f\"   Scheduled At: {c.get('scheduled_at', 'Not set')}\")
        if c['status'] == 'scheduled':
            print('   ✅ SUCCESS! Content is scheduled!')
        else:
            print('   ❌ Content NOT scheduled')
        break
" 2>/dev/null

echo ""
echo "=========================================="
echo "💡 Next steps:"
echo "   - Check Calendar page: http://localhost:3000/calendar"
echo "   - Check Content page (Scheduled tab): http://localhost:3000/content"
echo "=========================================="
