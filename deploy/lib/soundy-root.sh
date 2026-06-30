#!/usr/bin/env bash
# Resolve Soundy app root on VPS — prefer .env location (soundly vs legacy soundy).
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/soundy-root.sh"
if [ -z "${SOUNDY_ROOT:-}" ]; then
  if [ -f /opt/soundly/.env ]; then
    SOUNDY_ROOT=/opt/soundly
  elif [ -f /opt/soundy/.env ]; then
    SOUNDY_ROOT=/opt/soundy
  elif [ -d /opt/soundly ]; then
    SOUNDY_ROOT=/opt/soundly
  elif [ -d /opt/soundy ]; then
    SOUNDY_ROOT=/opt/soundy
  else
    SOUNDY_ROOT=/opt/soundly
  fi
fi
export SOUNDY_ROOT
ROOT="${SOUNDY_ROOT}"
