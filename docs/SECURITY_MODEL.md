# CANONATLAS — security and trust model

The objective is **evidence-scoped original-fiction canon coherence**, not truth about real people, ownership of stories, or general copyright validity.

## Main invariants

1. The world creator (steward) and passage author must be **different wallets**. The writer initiates the AI judgment; only the steward ratifies or declines an assessed proposal.
2. Initial rules include all three dimensions; the rule ID, category and exact text are frozen when a proposal is signed.
3. SHA-256 commitments cover scene bytes and canonical canon snapshots. Ratification refuses stale versions.
4. A deterministic bank of quotable exact text snippets is generated from that *frozen* snapshot. LLM cannot manufacture references, silently change categories, or cite nonexistent IDs.
5. Each AI check needs a matching scene reference and a same-dimension canon reference, plus an explicit result and nonempty rationale. Malformed or unverifiable output becomes `REVIEW`.
6. Comparative consensus checks the *semantic* three-dimension conclusion. Validator disagreement prevents acceptance. A leader-only output never authorizes ratification.
7. The final publication action is separate, human signed and requires persisted `CONSISTENT`; there is no auto-ratify action.
8. Only one pending proposal per world, at most 18 canon items, clear statuses and an explicit steward explanation for declined proposals.

## Honest constraints

AI models can still misunderstand a story despite literal references. Reference presence does not automatically prove a proposition: independent validators must judge the semantics. A source can be malicious, and no trusted external history is asserted. The app has no off-chain edit/publishing or IP enforcement capability. Wallet ownership is not real-world identity.

### Suggested adversarial live tests

Try a fake reference ID, a world-rules scene contradiction, overlapping proposal attempts and wrong-wallet writes. Record accepted and rolled-back status truthfully, without generating invented hashes. A rejected invalid transaction is useful security evidence only when the chain explorer actually records it.
