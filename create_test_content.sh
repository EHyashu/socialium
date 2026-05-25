#!/bin/bash
# Create a test content post

echo "=========================================="
echo "📝 CREATING TEST CONTENT"
echo "=========================================="
echo ""

WORKSPACE_ID="034533e9-1661-459a-bc0c-59ae17921499"

echo "Creating test post..."
RESPONSE=$(curl -s -X POST "http://localhost:8001/api/v1/content" \
  -H "Content-Type: application/json" \
  -d "{
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"platform\": \"linkedin\",
    \"title\": \"Test Post - AI in Marketing\",
    \"body\": \"The future of marketing is here! AI is transforming how we connect with audiences. From personalized content to predictive analytics, the possibilities are endless.\\n\\n#AI #Marketing #DigitalTransformation\",
    \"status\": \"draft\"
  }")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Verify it was created
echo "Verifying content was created..."
CONTENT_LIST=$(curl -s "http://localhost:8001/api/v1/content?workspace_id=$WORKSPACE_ID")

echo "$CONTENT_LIST" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Total content: {len(data)}')
for i, c in enumerate(data, 1):
    print(f'{i}. {c.get(\"title\", \"Untitled\")} - Status: {c[\"status\"]} - Platform: {c.get(\"platform\", \"N/A\")}')
" 2>/dev/null || echo "Failed to verify"

echo ""
echo "=========================================="
echo "✅ Content created!"
echo "💡 Now go to: http://localhost:3000/scheduling"
echo "=========================================="
