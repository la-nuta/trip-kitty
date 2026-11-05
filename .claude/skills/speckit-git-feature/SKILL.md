---
name: "speckit-git-feature"
description: "Create or switch to the git feature branch (NNN-short-name) before a new Spec Kit feature is specified. Runs as the before_specify hook."
argument-hint: "Feature description or short name"
compatibility: "Requires spec-kit project structure with .specify/ directory and a git repository"
metadata:
  author: "trip-kitty"
  source: ".specify/extensions.yml (before_specify hook)"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

## Steps

1. Derive the feature short name (2–4 words, kebab-case, action-noun) from the user input, the
   same way `/speckit-specify` step 1 does. When this runs as the `before_specify` hook, reuse
   the short name `/speckit-specify` will use, so the branch and the `specs/` directory match.
   If the user gave an explicit `GIT_BRANCH_NAME`, skip the script and run
   `git switch -c <GIT_BRANCH_NAME>` (or `git switch` if it exists) instead.

2. From the repo root, run once:

   ```sh
   .specify/scripts/bash/create-feature-branch.sh --short-name "<short-name>"
   ```

   The number is the next free `NNN` across `specs/` directories and local branches. Pass
   `--number N` only if the user asked for a specific number.

3. Parse the JSON on stdout: `BRANCH_NAME`, `FEATURE_NUM`, `CREATED`. Report them in one line
   (for example: "Created branch `002-expense-entry`" or "Switched to existing branch ...").

4. On a non-zero exit, show the script's error and stop; do not continue with
   `/speckit-specify` until the user decides how to proceed.

Do not commit, push, or create a remote branch.
