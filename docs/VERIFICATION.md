# Verification record

## Completed checks

- **43 contract tests passed** using the real GenVM unit-test harness and mocked external HTTP/LLM responses.
- **27 frontend/domain/wallet tests passed**, including evidence tampering, historical hashes, validation bounds, chain switching, account mismatch, receipt decoding, disagreement handling and finality errors.
- Contract safety lint and SDK validation passed: three views and three writes.
- Three historical case studies completed against live Studionet validators.
- Eight demo transactions finalized successfully: deployment, three registrations, three initial audits and one evidence challenge.
- Packaged Python source hash matched the network's returned source bytes.
- Read-only verification confirmed receipts and immutable history.
- Browser QA confirmed live finalized reads, SHA-256 indicators, history, filters, watchlist, ledger navigation, creation templates, review/sign screen and JSON export.
- Responsive QA uses a 390px iframe (375px content area with its scrollbar), not a physical mobile-device wallet.

Exact automated output is in verification/. The main live public record is test_report.json; deployment_info.json contains the source hashes and deployment receipt.

## Expected demo state

| Case | Initial state | Recorded final state |
| --- | --- | --- |
| Automatic OPTIONS | REVIEW: configurable supported, default inconclusive | BLOCKED after adding src/flask/app.py; default contradicted |
| Python compatibility | CAUTION: Python floor supported, CSV export inconclusive | CAUTION |
| Runtime requirements | VERIFIED: Python floor and changelog assertions supported | VERIFIED |

These findings were observed on the live network for the supplied fixed comparisons. A future model or validator set may reason differently; the stored findings are the actual consensus outcome of the recorded transactions. Later public challenges can append new findings.

## Wallet verification scope

The live provider smoke test **passed**. Its separate registry is 0x512dcFAD54177cBdDce1bB019f9dfD2C0c258f65. Registration, audit and challenge all finalized and evidence hashes matched.

The live wallet smoke utility deploys a separate registry and calls the same JavaScript adapter used by the UI through a scripted EIP-1193 provider. It exercises real signatures, zero-value writes, registration, audit, evidence challenge, finality and readback without modifying the packaged demo registry.

If verification/wallet-report.json is included and has status PASSED, that live run completed. This is not a test of a specific installed wallet extension's prompts or behavior. No real MetaMask extension was installed or automated for browser QA.

## Limits of testing

Tests are not a third-party security audit or a statistical measure of model accuracy. They do not establish production performance, prompt-injection immunity, GitHub ownership or availability of Studionet after network resets. GitHub Pages publication still requires the repository owner to enable Pages and push the included files.
