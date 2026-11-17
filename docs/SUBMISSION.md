# Project submission copy

## Project name

ReleaseProof

## One-liner

Consensus-backed release reviews that check software claims against immutable GitHub diffs, with cited evidence and an auditable challenge history.

## Description

ReleaseProof helps maintainers, technical reviewers and funding teams check whether specific software-release claims are supported by source changes. A real GenLayer Intelligent Contract freezes a public repository, baseline/head commit hashes, claim text and blocking policy. Validators independently fetch bounded GitHub diffs and evaluate each assertion as Supported, Contradicted or Inconclusive. Decisive findings must cite exact changed lines. New file evidence can revise a finding while preserving the original history. The responsive app connects to Studionet wallets, registers releases, runs audits, submits challenges, verifies evidence hashes and exports review bundles. Three historical Flask/Click case studies show supported claims, uncertainty and a successful evidence challenge. Their assertions are illustrative, not statements by upstream maintainers.

## Suggested topics

Choose the closest available primary tag for developer tooling or verification. Choose precise secondary topics such as software supply chain, evidence verification or intelligent contracts only if the portal offers them. Do not invent unavailable tag labels.

## How-to

1. Open the project website. Select Automatic OPTIONS, then Review history to inspect its initial and revised findings.
2. Open the site in a wallet-enabled browser and connect your wallet. Fund the same address with Studionet test GEN in GenLayer Studio.
3. Select New release and choose the Automatic OPTIONS historical template.
4. Review its fixed comparison, claims and file paths, then sign registration. Wait for finality.
5. Select Run GenLayer audit, sign and wait. The initial gate should be More evidence needed.
6. Select the disabled-by-default claim and Challenge with evidence. Add src/flask/app.py and explain that its default is explicitly True. Sign and wait.
7. Inspect the revised finding and preserved history. Export the evidence JSON.

## Expected verification outcome

The demo exposes real finalized Studionet records and SHA-256-verified diffs. Creating a fresh Automatic OPTIONS review produces an initial inconclusive default-setting finding; adding src/flask/app.py changes it to Contradicted while preserving the original history. Wallet writes and downloadable evidence are available. Live consensus may vary.

## Contract link

https://explorer-studio.genlayer.com/address/0xA2d587FE67B4866079e14a058aB6822bbb56f5D0

## Website, repository and evidence

Use your actual public GitHub Pages URL after deployment and the repository URL after pushing. Attach the repository as evidence. A private preview may not be accessible to stewards.

Do not claim a guaranteed points award, usage numbers, production adoption or a security audit. The project's proof is its source, tests, live receipts, usable interface and reproducible review flow.
