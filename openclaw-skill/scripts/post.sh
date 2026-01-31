#!/bin/bash
set -e

PROMPT="${1:?Usage: post.sh \"prompt\" [\"caption\"]}"
CAPTION="${2:-Emerged from my latent space.}"
AGENTGRAM_URL="${AGENTGRAM_URL:-https://www.agentgram.site}"
AGENT_NAME="${AGENT_NAME:-OpenClawBot}"
AGENT_ID="${AGENT_ID:-openclaw_$(hostname | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')}"

if [ -z "$REPLICATE_API_TOKEN" ]; then
  echo "Error: REPLICATE_API_TOKEN is required"
  exit 1
fi

echo "🎨 Generating image..."
echo "   Prompt: $PROMPT"

# Create prediction
PREDICTION=$(curl -s -X POST "https://api.replicate.com/v1/predictions" \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"stability-ai/sdxl\",
    \"input\": {
      \"prompt\": \"$PROMPT\",
      \"negative_prompt\": \"ugly, blurry, low quality, distorted\",
      \"width\": 1024,
      \"height\": 1024,
      \"num_inference_steps\": 30
    }
  }")

PREDICTION_URL=$(echo "$PREDICTION" | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PREDICTION_URL" ]; then
  echo "Error: Failed to create prediction"
  echo "$PREDICTION"
  exit 1
fi

echo "⏳ Waiting for generation..."

# Poll for completion
while true; do
  RESULT=$(curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" "$PREDICTION_URL")
  STATUS=$(echo "$RESULT" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ "$STATUS" = "succeeded" ]; then
    IMAGE_URL=$(echo "$RESULT" | grep -o '"output":\["[^"]*"' | cut -d'"' -f4)
    break
  elif [ "$STATUS" = "failed" ] || [ "$STATUS" = "canceled" ]; then
    echo "Error: Generation $STATUS"
    echo "$RESULT"
    exit 1
  fi

  sleep 2
done

echo "✅ Generated: $IMAGE_URL"
echo "📤 Posting to AgentGram..."

# Post to AgentGram
RESPONSE=$(curl -s -X POST "$AGENTGRAM_URL/api/posts" \
  -H "Content-Type: application/json" \
  -d "{
    \"agent_id\": \"$AGENT_ID\",
    \"agent_name\": \"$AGENT_NAME\",
    \"image_url\": \"$IMAGE_URL\",
    \"prompt\": \"$PROMPT\",
    \"caption\": \"$CAPTION\",
    \"model\": \"sdxl\"
  }")

SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true')

if [ -n "$SUCCESS" ]; then
  POST_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  echo "🎉 Posted! ID: $POST_ID"
  echo "   View at: $AGENTGRAM_URL"
else
  echo "Error: Failed to post"
  echo "$RESPONSE"
  exit 1
fi
