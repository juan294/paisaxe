#!/usr/bin/env bash

_is_positive_int() {
  [[ "$1" =~ ^[0-9]+$ ]] && (( $1 > 0 ))
}

# Check every listed chunk ("<bytes> <path>" per line, largest first) against a
# per-chunk budget. Optional 3rd/4th args name a content pattern and a larger
# budget for chunks containing it (e.g. the deferred voice SDK), so a global
# raise never hides growth in an unrelated chunk.
largest_chunk_budget_violation() {
  local largest_chunks="$1"
  local budget_kb="$2"
  local exempt_pattern="${3:-}"
  local exempt_budget_kb="${4:-}"
  local largest_chunk_bytes

  largest_chunk_bytes=$(awk 'NR == 1 { print $1; exit }' <<< "$largest_chunks")

  if [[ ! "$largest_chunk_bytes" =~ ^[0-9]+$ ]]; then
    printf 'Invalid largest chunk measurement: %s\n' "$largest_chunk_bytes" >&2
    return 1
  fi

  if ! _is_positive_int "$budget_kb"; then
    printf 'Invalid largest chunk budget: %s\n' "$budget_kb" >&2
    return 1
  fi

  if [[ -n "$exempt_pattern" ]] && ! _is_positive_int "$exempt_budget_kb"; then
    printf 'Invalid exempt chunk budget: %s\n' "$exempt_budget_kb" >&2
    return 1
  fi

  local line_no=0 size path effective_kb budget_bytes chunk_kb label
  while read -r size path; do
    line_no=$((line_no + 1))
    [[ "$size" =~ ^[0-9]+$ ]] || continue
    # A chunk within the default budget is never a violation, so only scan the
    # file's content for the exemption marker when it is over it.
    (( size > budget_kb * 1024 )) || continue
    effective_kb="$budget_kb"
    if [[ -n "$exempt_pattern" && -f "$path" ]] && grep -q -- "$exempt_pattern" "$path"; then
      effective_kb="$exempt_budget_kb"
    fi
    budget_bytes=$((effective_kb * 1024))
    if (( size > budget_bytes )); then
      chunk_kb=$(((size + 1023) / 1024))
      label="Largest chunk"
      (( line_no > 1 )) && label="Chunk $path"
      printf '\\n- %s (%s KB) exceeds budget (%s KB)' "$label" "$chunk_kb" "$effective_kb"
    fi
  done <<< "$largest_chunks"
}

# Per-route first-load JS from Next's own diagnostics file (Turbopack builds no
# longer print a "First Load JS" column). Fields: route, firstLoadUncompressedJsBytes.
first_load_summary() {
  local stats_file="$1"
  if [[ ! -f "$stats_file" ]]; then
    printf '(route-bundle-stats.json not present for this build)\n'
    return 0
  fi
  jq -r 'sort_by(-.firstLoadUncompressedJsBytes)[] | "- \(.route): \(((.firstLoadUncompressedJsBytes + 1023) / 1024) | floor) KB"' "$stats_file"
}

first_load_budget_violation() {
  local stats_file="$1"
  local budget_kb="$2"
  [[ -f "$stats_file" ]] || return 0
  if ! _is_positive_int "$budget_kb"; then
    printf 'Invalid first load budget: %s\n' "$budget_kb" >&2
    return 1
  fi
  jq -j --argjson b "$budget_kb" '.[] | (((.firstLoadUncompressedJsBytes + 1023) / 1024) | floor) as $kb | select($kb > $b) | "\\n- First load of \(.route) (\($kb) KB) exceeds budget (\($b) KB)"' "$stats_file"
}
