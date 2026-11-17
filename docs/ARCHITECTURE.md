# Architecture

ReleaseProof stores immutable release scopes and an append-only history of consensus findings. It is a static React application connected directly to a GenLayer Intelligent Contract.

## Two independent consensus operations

**Evidence acquisition.** The contract constructs a GitHub compare API URL from validated repository and full commit hashes. Leader and validators independently fetch the selected patches and compare the canonical evidence exactly. A failed or unsupported comparison produces no audit state.

**Semantic review.** The leader evaluates every assertion against that evidence. Validators independently evaluate the same assertions, validate the leader's response structure and exact changed-line witnesses, and compare every verdict. They need not generate the same witness text independently, but every proposed decisive witness must be an actual added/deleted line in an allowed file.

Everything in claims, code, paths and challenge reasons is untrusted data. The prompt explicitly rejects embedded instructions. Deterministic validation blocks invented files/lines and malformed results. This reduces, but cannot eliminate, semantic model error or prompt-injection risk.

~~~mermaid
flowchart TD
  A["Immutable release scope"] --> B["Independent GitHub fetches"]
  B --> C["Canonical evidence agrees"]
  C --> D["Independent claim reviews"]
  D --> E{"Valid witnesses and matching verdicts?"}
  E -->|Yes| F["Store findings and release gate"]
  E -->|No| G["No state change"]
  H["New changed-file challenge"] --> B
  F --> I["Original history plus revisions"]
~~~

## State model

Each release stores its publisher address, title, repository, baseline/head hashes, original claim JSON, canonical evidence JSON and review-history JSON. A claim has an ID, assertion, blocking flag and initial file paths.

Registration does not fetch or evaluate anything. An unaudited release has gate PENDING. Anyone can run its first audit, but a successful initial audit cannot be overwritten.

A challenge may add files not previously considered for the selected claim. Previously stored evidence is reused; newly introduced files are fetched with the same fixed comparison endpoints. The union remains bounded. A changed verdict appends a revision with the requester's address, timestamp, reason and exact evidence-subset hash. A same-verdict challenge reverts. The UI's current finding is the last history row for that claim.

## Deterministic gate precedence

| Condition, in order | Gate | UI |
| --- | --- | --- |
| No initial review | PENDING | Awaiting review |
| Any blocking contradiction | BLOCKED | Contradiction found |
| Any blocking uncertainty | REVIEW | More evidence needed |
| Any remaining advisory contradiction or uncertainty | CAUTION | Review advisory claims |
| Every selected claim supported | VERIFIED | Claims supported |

VERIFIED is deliberately displayed as “Claims supported”, because this is not a general software safety verdict.

## Evidence constraints

- Public GitHub comparisons only; no arbitrary URL fetching.
- Exact 40-character lowercase baseline and head SHAs; baseline must be the merge base.
- Ahead comparison with 1–100 complete listed commits and the expected final head.
- Fewer than 300 changed files in the comparison.
- Up to six selected files; each patch at most 4,000 UTF-8 bytes.
- At most 18,000 bytes of canonical escaped evidence JSON.
- GitHub response at most 1,000,000 bytes. This bound is checked after the request returns.
- Added/deleted line counts must match GitHub's metadata to detect incomplete patches.
- A decisive witness is an exact full added/deleted line, including its prefix, at most 500 UTF-8 bytes.

The bounds intentionally exclude large reviews, binary patches and unchanged files. Review small, coherent comparisons.

## Frontend and finality

The frontend uses genlayer-js 1.1.8 with the Studionet chain definition. Reads use LATEST_FINAL. Writes use the wallet provider and a zero application value.

The app checks the wallet chain and active address before signing. Its tracker accepts either a GenLayer transaction ID or an EVM hash and can decode the NewTransaction event to find the protocol ID. A finalized receipt is not automatically a successful execution. Success requires a successful leader execution or the documented quorum short-circuit with an explicit agreement result.

Pending IDs are saved in local storage. A timeout keeps the operation pending; it does not silently submit another transaction. If local storage is cleared or a wallet returns no transaction ID after broadcast, inspect that wallet's history before submitting again.

Watchlists and pending-operation metadata are browser-local. Shared reviews and evidence live in the contract. No backend, user database, secret AI key, payment or private-key import exists in the frontend.

## Evidence integrity versus trust

The browser checks every patch digest, the current canonical snapshot and each historical evidence-subset digest. This detects accidental corruption within the response or export. It is not a cryptographic light-client proof of chain state: the application still trusts its configured RPC and the network consensus.

The contract records the publisher's wallet, not GitHub repository ownership. A person may create a review for any public repository. Example assertions in this project are illustrative and must not be attributed to upstream maintainers.

## Next engineering work

Before production use: independent contract review, adversarial live-model evaluation, explicit governance for admission/spam resistance, registry discovery/pagination beyond the current bound, RPC verification strategy and network migration testing. The current deployment is Studionet only.
