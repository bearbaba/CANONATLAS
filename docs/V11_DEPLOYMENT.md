# CANONATLAS V1.1 — validator-consistency upgrade

## What changed (November 17, 2026)

**New file:** `contracts/canon_atlas_v11.py` — separate, deployable version. Do not overwrite the original V1 deployment.

V1's assessment made the validators compare verbose JSON containing freeform reasons and model-selected reference IDs. That introduces variance even when all validators agree on the scene's meaning. V1.1 moves the consensus boundary to **only three AI classification labels**: `continuity`, `chronology`, and `world_rules`. Each validator independently re-runs the analysis against the **same frozen scene and canon** using `gl.vm.run_nondet_unsafe`. An all-PASS result is accepted only when the validator independently finds all three PASS. Conservative REVIEW or CONFLICT outcomes cannot authorize a canon update, so variance in explanation wording does not block safe steward review.

After consensus, deterministic contract code constructs citation objects directly from the frozen reference bank, using literal `scene:1` and the first stored rule for each dimension. These references identify which input passages were considered; they are **not** a proof the AI's semantic inference is correct. No model-invented or rewritten citation text is accepted.

Malformed AI output is normalized to all-REVIEW (never a false PASS). The role separation, immutable scene and canon hashes, one-pending-entry guard, and human-only `ratify_entry` are unchanged.

## Important limitation: immutable deployed state

The original deployment `0x7Ce8aD067679a76a43b3C8f6d64F10A6D8f02eA0` is V1.0 and **still owns World #1 and World #2**. Updating GitHub does not upgrade deployed code or migrate that state.

To test V1.1:
1. Deploy `contracts/canon_atlas_v11.py` as a **new Intelligent Contract on Studionet**, using the Studio deployment flow.
2. In CANONATLAS > GenLayer console, paste the **new contract address**. The UI accepts V1.0 and V1.1 and performs read-only `stats` verification before any signature.
3. With Steward, create a **new world on V1.1**, then use a separate Author to propose a scene, run `assess_entry`, and check Explorer's FINALIZED/Accepted receipt plus LATEST_FINAL entry.
4. Only if the accepted entry is `CONSISTENT` should Steward ratify. Record every hash.

**No real Studionet consensus acceptance is claimed for V1.1 yet.** Unit tests simulate GenVM validator behavior. An all-PASS candidate may still become Undetermined if validators independently disagree; the design intentionally does not bypass independent consensus.

Keep V1 World #2 and both historic Undetermined assessments as separate, authentic evidence — never claim they moved to V1.1.
