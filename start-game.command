#!/bin/zsh

# ==============================================================================
# Pukar Card Game - Clickable One-Click Launcher (macOS)
# Spins up the local server and automatically opens the game in your browser.
# ==============================================================================

# Change directory to the folder containing this script
cd "$(dirname "$0")" || exit 1

echo ""
echo "  ♠ ♥ ♦ ♣  PUKAR CARD GAME - LAUNCHER  ♣ ♦ ♥ ♠"
echo "  ============================================"
echo ""

# 1. Environment & Node.js resolution (ensures modern Node 20+ is active)
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # Load nvm
  \. "$NVM_DIR/nvm.sh"
fi

# Prefer Node v20 from NVM if available
if [ -d "$HOME/.nvm/versions/node/v20.20.2/bin" ]; then
  export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
elif [ -d "$HOME/.nvm/versions/node" ]; then
  LATEST_NODE=$(ls -1d "$HOME/.nvm/versions/node"/v* 2>/dev/null | tail -n 1)
  if [ -n "$LATEST_NODE" ]; then
    export PATH="$LATEST_NODE/bin:$PATH"
  fi
fi

CURRENT_NODE=$(node -v 2>/dev/null || echo "none")
echo "✓ Node runtime: $CURRENT_NODE"

# Ensure Node >= 18 is active for Vite 6 compatibility
NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])' 2>/dev/null || echo "0")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "⚠️ Current Node is $CURRENT_NODE, which is older than Node 18."
  echo "Attempting to switch via nvm..."
  if command -v nvm >/dev/null 2>&1; then
    nvm use 20 2>/dev/null || nvm use 18 2>/dev/null || true
  fi
fi

# 2. Check dependencies
if [ ! -d "node_modules" ]; then
  echo "📦 Installing project packages (first-time launch)..."
  npm install
fi

echo ""
echo "🚀 Spinning up local server..."
echo "🌐 Turning the game on in your default web browser..."
echo ""
echo "ℹ️  Game URL: http://localhost:5173"
echo "ℹ️  To close the game server, press Ctrl + C in this window."
echo "------------------------------------------------------------"

# Graceful exit handler
cleanup() {
  echo ""
  echo "🛑 Stopping game server..."
  sleep 1
  exit 0
}
trap cleanup SIGINT SIGTERM

# 3. Start Vite dev server and automatically launch browser
npm run dev -- --open
