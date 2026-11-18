# CANONATLAS — Project Explorer Review Evidence
**Evidence date:** 18 November 2026
**Project:** CANONATLAS — The Living Canon Protocol
**Category:** Builder / Projects / GenLayer Project Explorer

## Reviewer quick links

- **Website:** https://canonatlas.vercel.app
- **Open-source repository:** https://github.com/bearbaba/CANONATLAS
- **Full video walkthrough (English subtitles):** https://youtu.be/3Rx6wV-JR_I
- **V1.1 contract on Studionet:** https://studio.genlayer.com/?import-contract=0x9a08fa0BcE251D5423af41bf5f287bd32BF3779d
- **V1.1 contract source:** https://github.com/bearbaba/CANONATLAS/blob/main/contracts/canon_atlas_v11.py
- **CI & read-only deployment verification:** https://github.com/bearbaba/CANONATLAS/actions

## Real end-to-end on-chain test: The Lantern Isles, World #1 (V1.1)

Separate stewardship and authorship are core security boundaries: the world owner signs creation and ratification; a different wallet signs proposal and AI assessment. No simulated accepted result is offered as main evidence.

| Action | TX hash | Observed on-chain / LATEST_FINAL effect |
|---|---|---|
| `create_world` | [`0x6093a995d9d1397c318b6bb2f6b2b82b89190b77a5bbbfc31ab5ef2f6983269f`](https://explorer-studio.genlayer.com/tx/0x6093a995d9d1397c318b6bb2f6b2b82b89190b77a5bbbfc31ab5ef2f6983269f) | FINALIZED / Accepted / GenVM SUCCESS. Return value World #1. Three original canon rules. |
| `propose_entry` | [`0xea38e40cbce27d30be9cb024ff473120a349c706761f8944dec21104fdfbd276`](https://explorer-studio.genlayer.com/tx/0xea38e40cbce27d30be9cb024ff473120a349c706761f8944dec21104fdfbd276) | Author-signed Entry #1 with immutable submitted scene and SHA-256. |
| `assess_entry` | [`0x3e6593206e882f28818757e198f86d457f7620df20399b1af26364185b5fd12e`](https://explorer-studio.genlayer.com/tx/0x3e6593206e882f28818757e198f86d457f7620df20399b1af26364185b5fd12e) | FINALIZED / Accepted; `CONSISTENT`; continuity, chronology and world_rules PASS. |
| `ratify_entry` | [`0x9ea7c1ab5cd142563fe416d815894163ff610c9b2287e31fb15bca26a6f312eb`](https://explorer-studio.genlayer.com/tx/0x9ea7c1ab5cd142563fe416d815894163ff610c9b2287e31fb15bca26a6f312eb) | FINALIZED / Accepted. Entry #1 RATIFIED, World #1 canon v1 → v2, `pending_entry=0`. |

The source and demo show a **real Intelligent Contract workflow**: owner locks a world and its initial canon; an independent author signs an original chapter; GenLayer independently evaluates three frozen dimensions; then only the owner can ratify. Accepted consensus does not grant copyright ownership or publish content elsewhere.

## Independent verification instructions

1. Open V1.1 Studio contract and inspect `stats`; expect `name=CANONATLAS`, `version=1.1.0`, three criteria and steward ratification policy.
2. Read `get_world(1)` using LATEST_FINAL. Check title *The Lantern Isles*, `canon_version=2`, `pending_entry=0` and `ratified_entries` contains Entry #1.
3. Read `get_entry(1)`; check `RATIFIED`, `assessment.verdict=CONSISTENT`, three PASS checks, original author and SHA-256 commitment.
4. Inspect `get_reference_bank(1)` and compare reported literal scene/canon references with frozen input snippets.
5. Inspect the four Explorer links and the uncut source evidence as illustrated in the full screen recording.
6. Review the repository's Python tests, browser UI tests, deployment-source check and the original contract file.

## Responsible documentation of older V1 consensus limitations

**Old V1 deployment (different state):** https://studio.genlayer.com/?import-contract=0x7Ce8aD067679a76a43b3C8f6d64F10A6D8f02eA0

- [`0xa264c8d59d4ed77d351d531a828eb5b798affd21fd5d69ade57904cc103f1cf7`](https://explorer-studio.genlayer.com/tx/0xa264c8d59d4ed77d351d531a828eb5b798affd21fd5d69ade57904cc103f1cf7): FINALIZED / Undetermined. Leader attempted REVIEW; **not a committed decision**.
- [`0xdf72cd94e44bfa1ff5f7c5c4821a0a694505434febe2aaea52c86062986764a9`](https://explorer-studio.genlayer.com/tx/0xdf72cd94e44bfa1ff5f7c5c4821a0a694505434febe2aaea52c86062986764a9): FINALIZED / Undetermined; invalid/missing assessment reference formatting, without an accepted AI decision.

Those are **V1 failure-mode examples**, not V1.1 failures, and are included for transparency. V1 state was not migrated and was not altered by deploying V1.1.

## Boundaries

- Demonstrated on **GenLayer Studionet (test network)**, not mainnet.
- AI reasoning is subjective and not guaranteed factually correct; reference IDs identify fixed source material, not the truth of an inference.
- Only accepted and independently verified chain results can update the community canon.
- No token, royalties, copyright transfer, automatic public posting, or ownership adjudication.
- The video is a condensed edit of real recordings with English caption overlays.
