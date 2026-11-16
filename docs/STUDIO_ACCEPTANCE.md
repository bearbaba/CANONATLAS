# CANONATLAS — Studionet acceptance runbook

**Target network:** GenLayer Studionet, chain ID **61999**. Studio: https://studio.genlayer.com. This is a procedure to perform after deployment, not proof that the listed transactions have occurred.

## Roles and deployment

Open [the source contract](../contracts/canon_atlas.py) in Studio. Select **Normal / Full Consensus**, turn **Simulation OFF**, and deploy `CanonAtlas()` **with no constructor arguments**. Record the exact deployed address, deployment transaction hash and deployed RPC source; compare that RPC source to the committed file after normalizing line endings. Do not type an invented address in README.

Use **two different wallets** throughout:
- Owner / **steward**: any Studionet account with test GEN, e.g. your first Studio account.
- Independent **author**: a second distinct Studionet account.

These roles are contract-enforced; no `admin` backdoor or demo bypass is provided.

## Step 1 — owner signs `create_world`

`title`:
```text
The Glass Archipelago
```

`premise`:
```text
A sea-bound world of light-bearing guardians, memory mirrors and irreversible tides.
```

`rules_json` (paste as one JSON string):
```json
[{"id":"CHAR1","kind":"continuity","text":"The Lumen Keepers preserve the solar lantern and none has crossed the Quiet Sea."},{"id":"TIME1","kind":"chronology","text":"The port of Ilyra was founded in year 140 and the Great Tide happened in year 162."},{"id":"LAW1","kind":"world_rules","text":"Mirrors store memories but cannot transport living bodies across water."}]
```

Expected global `world_id`: **1 only if this is a fresh deployment**. Read `get_world(actual_id)` and `stats()` from `LATEST_FINAL`. Verify exact owner, 3 dimensions, `canon_version=1`, no pending entry and SHA-256 commitment.

## Step 2 — author signs `propose_entry`

`world_id`: the actual returned world ID (typically 1). `title`:
```text
A lantern without a voyage
```

`scene` (preserve all punctuation and spaces):
```text
In year 166, apprentice Mira uncovered a mirror memory describing the Quiet Sea. She kept the original lantern in the citadel, sent an encoded message toward the distant Keepers, and refused the forbidden crossing, respecting the ancient law of mirrors.
```

`scene_sha256` for the exact single-line content above, without the enclosing code-fence newline:
```text
6ce7bc8c971250d3345650db3ba2f5a4f19bbc2b1ca530242ee219292af14db3
```

Read `get_entry(actual_entry_id)`. Confirm `SUBMITTED`, independent author, matching SHA-256 and canon snapshot. `get_reference_bank(entry_id)` exposes exact eligible quote IDs.

## Step 3 — same author signs `assess_entry(entry_id)`

Never promise a particular LLM verdict in advance. Verify the transaction is **FINALIZED / execution SUCCESS / consensus Accepted (MAJORITYAGREE)**, *and* independently read `get_entry(entry_id)` with `LATEST_FINAL`. Inspect three checked dimensions and literal citation IDs. An accepted `CONSISTENT` is required for Step 4. `REVIEW` or `CONFLICT` must not be ratified.

If the accepted result is REVIEW or CONFLICT, use the owner to `decline_entry(entry_id, explanation)` (after assessment), and preserve the real outcome in your evidence.

## Step 4 — owner signs `ratify_entry(entry_id)` only if CONSISTENT

Verify a separate accepted transaction and current finalized state:
- Entry status `RATIFIED` and its original author/scenario hash unchanged.
- World `canon_version=2`, `pending_entry=0`, appended `ENTRY_<id>` canon record and a new recomputed `canon_sha256`.
- Original `CHAR1`, `TIME1`, `LAW1` intact.

## Required failure-path tests

1. Owner proposing their own scene is rejected (`independent author wallet required`).
2. Wrong author running `assess_entry` is rejected.
3. Author calling `ratify_entry` is rejected.
4. Wrong SHA-256 is rejected.
5. Attempting ratification before accepted `CONSISTENT` fails.
6. A new proposal cannot overwrite a still-pending scene.

Record transaction hashes and on-chain readbacks accurately; a GenVM return alone or `FINALIZED / MajorityDisagree` is **not** accepted proof. Do not claim these tests were run if no signed traces exist.
