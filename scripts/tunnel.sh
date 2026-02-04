#!/bin/bash
# Start the Cloudflare tunnel for local development
# Usage: ./scripts/tunnel.sh
#
# This exposes localhost:3000 at https://paisaxe.tunnelfor.me
# Use with the Pelayo-Dev agent in ElevenLabs for testing webhooks.

set -e

echo "Starting Cloudflare tunnel for paisaxe..."
echo "URL: https://paisaxe.tunnelfor.me -> localhost:3000"
echo ""
echo "Make sure 'npm run dev' is running in another terminal."
echo "Press Ctrl+C to stop the tunnel."
echo ""

cloudflared tunnel --config ~/.cloudflared/config-paisaxe.yml run paisaxe
