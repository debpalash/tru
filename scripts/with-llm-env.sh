#!/usr/bin/env bash
set -euo pipefail
# App builds load only public configuration. Private .env belongs to the server.
export EXPO_NO_DOTENV=1
for name in EXPO_PUBLIC_GOOGLE_AI_API_KEY EXPO_PUBLIC_GROQ_API_KEY EXPO_PUBLIC_CEREBRAS_API_KEY EXPO_PUBLIC_OPENROUTER_API_KEY EXPO_PUBLIC_NVIDIA_API_KEY EXPO_PUBLIC_FIRECRAWL_API_KEY EXPO_PUBLIC_HF_TOKEN; do
  unset "$name"
done
exec "$@"
