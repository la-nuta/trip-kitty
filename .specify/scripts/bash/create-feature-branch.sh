#!/usr/bin/env bash
# Create (or switch to) the git branch for a new Spec Kit feature.
# Called by the before_specify hook in .specify/extensions.yml via /speckit-git-feature.
#
# Usage: create-feature-branch.sh --short-name <name> [--number N]
# Output (stdout, JSON): {"BRANCH_NAME":"001-user-auth","FEATURE_NUM":"001","CREATED":true}

set -euo pipefail

SHORT_NAME=""
NUMBER=""
while [ $# -gt 0 ]; do
    case "$1" in
        --short-name) SHORT_NAME="${2:-}"; shift 2 ;;
        --number) NUMBER="${2:-}"; shift 2 ;;
        -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
        *) echo "Error: unknown argument '$1'" >&2; exit 1 ;;
    esac
done

if [ -z "$SHORT_NAME" ]; then
    echo "Error: --short-name is required" >&2
    exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo "Error: not a git repository" >&2
    exit 1
}
cd "$REPO_ROOT"

SUFFIX=$(printf '%s' "$SHORT_NAME" | LC_ALL=C tr '[:upper:]' '[:lower:]' \
    | LC_ALL=C sed -e 's/[^a-z0-9]/-/g' -e 's/--*/-/g' -e 's/^-//' -e 's/-$//')
if [ -z "$SUFFIX" ]; then
    echo "Error: short name '$SHORT_NAME' has no letters or digits" >&2
    exit 1
fi

# Reuse the number of an existing branch or specs/ directory with the same short name.
if [ -z "$NUMBER" ]; then
    NUMBER=$( { ls -1 specs 2>/dev/null || true; git for-each-ref --format='%(refname:short)' refs/heads; } \
        | grep -E "^[0-9]{3,}-${SUFFIX}\$" | grep -Eo '^[0-9]+' | head -1 || true)
fi

# Otherwise the next number: highest NNN- prefix across specs/ directories and local branches, plus one.
if [ -z "$NUMBER" ]; then
    highest=0
    candidates=$( { ls -1 specs 2>/dev/null || true; git for-each-ref --format='%(refname:short)' refs/heads; } \
        | grep -Eo '^[0-9]{3,}-' | grep -Eo '^[0-9]+' || true)
    for n in $candidates; do
        n=$((10#$n))
        [ "$n" -gt "$highest" ] && highest=$n
    done
    NUMBER=$((highest + 1))
fi
if ! [[ "$NUMBER" =~ ^[0-9]+$ ]]; then
    echo "Error: --number must be an unsigned integer, got '$NUMBER'" >&2
    exit 1
fi
FEATURE_NUM=$(printf '%03d' "$((10#$NUMBER))")
BRANCH_NAME="${FEATURE_NUM}-${SUFFIX}"

CURRENT=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT" = "$BRANCH_NAME" ]; then
    CREATED=false
elif git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    git switch --quiet "$BRANCH_NAME" >&2
    CREATED=false
else
    if [ "$CURRENT" != "main" ]; then
        echo "[speckit-git] Warning: branching from '$CURRENT', not 'main'" >&2
    fi
    # Uncommitted changes are carried over to the new branch.
    git switch --quiet -c "$BRANCH_NAME" >&2
    CREATED=true
fi

printf '{"BRANCH_NAME":"%s","FEATURE_NUM":"%s","CREATED":%s}\n' "$BRANCH_NAME" "$FEATURE_NUM" "$CREATED"
