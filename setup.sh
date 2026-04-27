#!/usr/bin/env bash
set -euo pipefail

# ── Node version check ────────────────────────────────────────────────────────
node_major=$(node --version 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo "0")
if (( node_major < 22 )); then
  echo "Error: Node 22+ required (found: $(node --version 2>/dev/null || echo 'none'))"
  echo "Install via nvm: nvm install 22 && nvm use 22"
  exit 1
fi

# ── Python check ──────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "Error: python3 required but not found"
  exit 1
fi

# ── bd (beads) check ─────────────────────────────────────────────────────────
if ! command -v bd &>/dev/null; then
  echo "Error: bd (beads) not found — install from https://github.com/gastownhall/beads"
  exit 1
fi

# ── npm install ───────────────────────────────────────────────────────────────
echo "Installing npm dependencies..."
npm install

# ── Initial data generation ───────────────────────────────────────────────────
echo "Generating task data..."
./render.py --data

echo ""
echo "Setup complete. To start:"
echo "  ./dev.sh        — dev mode (editing enabled)"
echo "  ./render.py     — open dashboard (read-only)"
