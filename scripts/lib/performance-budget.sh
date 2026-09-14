#!/usr/bin/env bash

largest_chunk_budget_violation() {
  local largest_chunks="$1"
  local budget_kb="$2"
  local largest_chunk_bytes

  largest_chunk_bytes=$(awk 'NR == 1 { print $1; exit }' <<< "$largest_chunks")

  if [[ ! "$largest_chunk_bytes" =~ ^[0-9]+$ ]]; then
    printf 'Invalid largest chunk measurement: %s\n' "$largest_chunk_bytes" >&2
    return 1
  fi

  if [[ ! "$budget_kb" =~ ^[0-9]+$ ]] || (( budget_kb <= 0 )); then
    printf 'Invalid largest chunk budget: %s\n' "$budget_kb" >&2
    return 1
  fi

  local budget_bytes=$((budget_kb * 1024))
  if (( largest_chunk_bytes > budget_bytes )); then
    local largest_chunk_kb=$(((largest_chunk_bytes + 1023) / 1024))
    printf '\\n- Largest chunk (%s KB) exceeds budget (%s KB)' \
      "$largest_chunk_kb" "$budget_kb"
  fi
}
