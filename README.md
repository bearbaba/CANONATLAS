# CANONATLAS

### The Living Canon Protocol — original worlds, evidence-bound continuity

**An original-worldbuilding app powered by GenLayer Intelligent Contracts.** CANONATLAS helps writers and collaborative game communities publish new lore without silently contradicting an established world. A proposed scene is signed by an independent author, assessed by independent AI validators against three *frozen* canon dimensions, then separately ratified (or declined) by the human world steward.

> **Build status — 16 Nov 2026:** independent runnable source, wallet-aware frontend, source-pinned Python contract, local/shim unit tests and CI configuration are included. **Not yet deployed or validated on GenLayer Studionet.** The sample world and UI preview are local illustrative data; they are NOT accepted AI verdicts, blockchain evidence, copyright registrations, or live transactions. The target internal score of 9.5/10 is not claimed until signed live acceptance.

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

[**Studio acceptance guide**](docs/STUDIO_ACCEPTANCE.md) gives exact input values, wallets, SHA-256 and both positive and rejection tests. [**Security boundaries**](docs/SECURITY_MODEL.md) andthe release criteria avoid overstating completion.

## Proof status and constraints

**Local verified:** Python shim unit tests (security gates, immutable snapshots, citation integrity, distinct wallets, failure modes), Node.js authorization tests, source syntax. See current package output for counts.

**Not yet verified:** deployed Studionet source/ABI, accepted multi-validator consensus, full signed `SUBMITTED → CONSISTENT → RATIFIED`, browser-wallet E2E, remote CI run, and GitHub repository URL (this bundle has not been pushed to a new repository).

There is no token, payout, copyright transfer, ownership verification, user identity proof, paid service or auto-publication. Consensus applies only to the submitted text and frozen original-fiction canon; interpretations can be wrong.

## Technology

Python GenLayer Intelligent Contract • GenVM non-determinism • comparative validator consensus • pinned GenLayerJS 1.1.8 • vanilla JavaScript • responsive CSS • SHA-256 • GitHub Actions templates.

**License:** MIT; see [LICENSE](LICENSE). Fictional story fixture included for educational demos.
