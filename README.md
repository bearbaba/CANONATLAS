# CANONATLAS

### The Living Canon Protocol — original worlds, evidence-bound continuity

**An original-worldbuilding app powered by GenLayer Intelligent Contracts.** CANONATLAS helps writers and collaborative game communities publish new lore without silently contradicting an established world. A proposed scene is signed by an independent author, assessed by independent AI validators against three *frozen* canon dimensions, then separately ratified (or declined) by the human world steward.

> **Live Studionet verified — 16 Nov 2026:** CANONATLAS V1 is deployed at [`0x7Ce8aD067679a76a43b3C8f6d64F10A6D8f02eA0`](https://studio.genlayer.com/?import-contract=0x7Ce8aD067679a76a43b3C8f6d64F10A6D8f02eA0). World #1, “The Glass Archipelago,” completed a signed **create → propose → CONSISTENT (3/3 AI checks) → RATIFIED** workflow, with independent steward/author wallets. Verified `LATEST_FINAL` confirms Entry #1 `RATIFIED`, canon version **1 → 2**, updated SHA-256 and no pending entry. [GitHub Actions live attestation](https://github.com/bearbaba/CANONATLAS/actions/runs/43853942589) also checks deployed-source identity and literal evidence citations. The default example UI remains illustrative until a user connects the live contract.



### Verified live outcome — The Glass Archipelago, World #1

| Signed action | On-chain transaction | Accepted effect |
| --- | --- | --- |
| Steward creates original world | [`create_world`](https://explorer-studio.genlayer.com/tx/0xbe916fa29daef995bb83928153f12a660cc3567fba63c4a8fa16714af0a82ecc) | Version 1, three frozen canon rules |
| Independent author proposes chapter | [`propose_entry`](https://explorer-studio.genlayer.com/tx/0x1384d7090c28067de0a632066d1f76c82f5c05e50e6bcc79174550655e612cf5) | Signed Entry #1 and SHA-256 `e9a39e00efc04241d9fc923efa6e5a4d34ab706e91130f18ba17ac547ec3e39a` |
| Original author requests GenLayer consensus | [`assess_entry`](https://explorer-studio.genlayer.com/tx/0xeffe34873b1183459e0c94556efc2a8860d09a294a64ffe1572035de2e6e857a) | Accepted `CONSISTENT`; continuity, chronology and world_rules PASS with verified literal references |
| World steward ratifies the chapter | [`ratify_entry`](https://explorer-studio.genlayer.com/tx/0x36fe45d8308598e626e25ef5e045e62e7962da8e5d6233e0556e397e7bf6bcbc) | `RATIFIED`; canon version 2, `pending_entry=0`, `ratified_entries=[1]` |

**Independent readback:** [`scripts/verify-live.mjs`](scripts/verify-live.mjs) validates deployment source and `LATEST_FINAL` world and entry state, 3 criterion references, original and upgraded canon digests, signer independence and steward ratification. [Successful CI](https://github.com/bearbaba/CANONATLAS/actions/runs/43853942589). The story and rules are original fictional demonstration data; no copyright ownership or general AI accuracy is certified.

## V1.1 consensus stability candidate (not yet deployed)

A separate contract, [`contracts/canon_atlas_v11.py`](contracts/canon_atlas_v11.py), replaces verbose comparative-JSON consensus with three stable classification labels and validators that independently reassess the frozen canon. Its tests and deployment instructions are in [`docs/V11_DEPLOYMENT.md`](docs/V11_DEPLOYMENT.md). **V1 World #1/#2 and both Undetermined transactions remain on the original deployment; no data has been migrated.** Do not describe V1.1 as deployed or consensus-verified until a new Studionet transaction is accepted.

## Reviewer-facing website and wallet lifecycle

The deployed GenLayer Studionet contract is selected automatically when [the CANONATLAS website](https://canonatlas.vercel.app) loads. On a live `LATEST_FINAL` read, the visitor sees **World #1**, its ratified **canon version 2**, the status of **Entry #1**, and the **literal evidence/reference IDs** behind GenLayer's three AI judgments. These are read-only, independently finalized records, not a simulated AI verdict.

For a new world, the connected Steward creates the canon; a **different wallet** proposes a story and requests independent AI consensus; only the original Steward may ratify a consistent proposal. The application waits for **FINALIZED / successful execution / accepted consensus**, reads the new on-chain state and verifies the signer/entry before showing success. Browser refreshes and RPC timeouts preserve the transaction hash. The visitor can resume checking the same hash without submitting a duplicate signature; wallet/chain switches revoke signing authorization.

**Verification boundary:** Historical accepted and signed contract actions listed below were initiated through GenLayer Studio. Frontend flow tests use a simulated wallet; they are not a recording of a real user signing through the production site. A live browser wallet-signing walkthrough and a genuine screen capture remain necessary before claiming that final end-to-end demonstration.

## The product that makes this different

Imagine a writers' room where five people are contributing to an original universe. A new chapter says a traveler crosses an impassable sea using a mirror. Was that already forbidden by world rules? Did it happen before a referenced event? Does it contradict an established character arc?

**CANONATLAS makes those questions consequential.** Every world starts with authored, versioned canon statements covering **continuity, chronology, and world rules**. Every proposed scene is hashed, signed and evaluated against the exact canon snapshot from the moment of submission. The contract does not trust an AI-generated quotation: it creates a deterministic reference bank of literal text snippets, and the AI selects IDs. The consensus result can be **CONSISTENT, CONFLICT or REVIEW**, never an invented automatic PASS.

A CONSISTENT result does not automatically rewrite canon. **Only the world owner may explicitly ratify the passage**, creating a new immutable-on-chain canon version and linking the original author and scene SHA-256. A rejected or uncertain passage can be declined with an auditable human explanation.

## What is genuinely new here

- **Two independent wallets:** the world steward locks baseline canon and ratifies; a different author signs and requests assessment. An author cannot self-ratify.
- **Three-dimensional semantic consensus:** continuity, chronology, world rules; structured JSON and validator comparative review are essential because natural-language consistency cannot be fully reduced to code.
- **Evidence-ID citations:** the model selects only IDs from `reference_bank(scene, frozen_canon)`. Contract independently reconstructs and byte-checks the literal citations. Missing IDs, wrong dimensions, malformed assessments and questionable output remain REVIEW.
- **Immutable snapshots:** each scene retains `canon_version`, `canon_sha256`, `scene_sha256`, author, and the entire canonical rules snapshot.
- **Human governance:** one pending scene per world, no hidden canon rewrite, final steward-signed `RATIFIED` or reasoned `DECLINED` state.
- **Bounded state:** at most 18 canon items per world; scenes 80–600 chars, initial rules 3–9 with a strict dimension taxonomy.

## Live contract surface

| Write method | Authorized caller | Consequence |
| --- | --- | --- |
| `create_world(title,premise,rules_json)` | World steward | Establishes canonical rules and their hash |
| `propose_entry(world_id,title,scene,scene_sha256)` | Different author wallet | Freezes authored scene and current canon snapshot |
| `assess_entry(entry_id)` | Original author | Invokes GenLayer comparative AI; persists `CONSISTENT/CONFLICT/REVIEW` |
| `ratify_entry(entry_id)` | World steward | Only after accepted CONSISTENT, increments canon version |
| `decline_entry(entry_id,explanation)` | World steward | Closes assessed scene without changing canon |
| `get_world`, `get_entry`, `get_reference_bank`, `stats` | Anyone, read-only | Auditor-verifiable final state and reference IDs |

AI access uses `gl.nondet.exec_prompt(...,response_format='json')` under `gl.eq_principle.prompt_comparative`; consensus evaluates the *substance* of three dimensions, not merely JSON shape. Additional safeguards enforce exact citation IDs and the same current canon version before ratification.

## See and run the app

The `web/` directory is a fully designed responsive front end with an original-fiction fixture, editable canon, proposal wizard, live Studionet address input, wallet connection, and latest-final chain reads. **The static interface works without third-party packages**; live SDK reads and signing require installing the pinned `genlayer-stable` package.

```bash
# Open an illustrative preview without npm
python -m http.server 5173 --directory web
# visit http://localhost:5173

# For wallet-enabled GenLayer SDK integration
npm install
npm run dev

# Quality gates
python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.mjs
python -m py_compile contracts/canon_atlas.py
npm run build
npm run schema:studionet
```

The final two commands require a working npm package registry and Studionet RPC. The `genlayer-stable` dependency is pinned to `npm:genlayer-js@1.1.8`. A failure to install dependencies in a restricted/offline environment is **not** a claimed successful build.

## Original demonstration scenario

The **Glass Archipelago** is fictional. Its three immutable starting rules state that Keepers never crossed the Quiet Sea, Ilyra was founded before the Great Tide, and memory mirrors cannot transport bodies. A proposed scene about sending an encoded message rather than crossing the forbidden sea provides an illustrative **consistent candidate**. The contract must still obtain an actual accepted GenLayer AI assessment before ratification.

[**Studio acceptance guide**](docs/STUDIO_ACCEPTANCE.md) gives exact input values, wallets, SHA-256 and both positive and rejection tests. [**Security boundaries**](docs/SECURITY_MODEL.md) and the release criteria avoid overstating completion.

## Proof status and constraints

**Verified in CI:** 19 Python unit tests and 8 JavaScript tests, contract syntax, frontend production build and unsigned GenLayer ABI/schema checks. [GitHub Actions](https://github.com/bearbaba/CANONATLAS/actions). These tests do not replace signed Studionet consensus.

**Awaiting live acceptance:** deployed Studionet source/ABI, independently confirmed multi-validator consensus, the signed `SUBMITTED → CONSISTENT → RATIFIED` workflow and browser-wallet end-to-end verification. Use the [Studio acceptance guide](docs/STUDIO_ACCEPTANCE.md).

There is no token, payout, copyright transfer, ownership verification, user identity proof, paid service or auto-publication. Consensus applies only to the submitted text and frozen original-fiction canon; interpretations can be wrong.

## Technology

Python GenLayer Intelligent Contract • GenVM non-determinism • comparative validator consensus • pinned GenLayerJS 1.1.8 • vanilla JavaScript • responsive CSS • SHA-256 • GitHub Actions templates.

**License:** MIT; see [LICENSE](LICENSE). Fictional story fixture included for educational demos.
