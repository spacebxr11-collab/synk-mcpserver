#!/bin/bash
# test-mcp.sh - Verify the SSE handshake for the Headless MCP server

VERCEL_URL=${1:-"http://localhost:3000"}
SECRET=$SYNK_MCP_SECRET

echo "Testing SSE Handshake at $VERCEL_URL/api/mcp/sse..."

curl -N -H "Authorization: Bearer $SECRET" \
     -H "Accept: text/event-stream" \
     "$VERCEL_URL/api/mcp/sse" | while read -r line; do
    echo "RECEIVED: $line"
    if [[ "$line" == *"event: endpoint"* ]]; then
        echo "✅ SSE Handshake successful!"
        exit 0
    fi
done
