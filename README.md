# ReleaseProof

**Check what changed. Prove what shipped.**

A GenLayer application that reviews software release assertions against immutable GitHub diffs. Register a comparison, state specific claims, and let validators independently inspect the evidence. A successful evidence challenge creates a new finding without erasing the original review.

The complete project includes a premium responsive React dashboard, a deployed Intelligent Contract, browser-wallet transactions, portable evidence exports, tests, deployment utilities and a GitHub Pages workflow.

## Live contract

- Network: **GenLayer Studionet**, chain **61999**
- Address: **0xA2d587FE67B4866079e14a058aB6822bbb56f5D0**
- [Contract explorer](https://explorer-studio.genlayer.com/address/0xA2d587FE67B4866079e14a058aB6822bbb56f5D0)
- Source SHA-256: 70879dc3651af8b516e18169fc9acafae7c943465f260618aec85873f05fcd02

The packaged source was compared with the bytes returned by the network. The demo records contain seven finalized application transactions, plus the deployment transaction. Exact hashes are in [deployment_info.json](deployment_info.json) and [test_report.json](test_report.json).

## Why this exists

A changelog, grant update or release announcement can say more than a selected source change proves. ReleaseProof separates supported claims from contradictions and missing evidence. It gives maintainers, reviewers and funding teams a narrow, inspectable review trail.

GenLayer is central to this workflow: the contract fetches the GitHub comparison and runs semantic claim evaluation under validator consensus. The frontend does not invent verdicts or call a separate hosted AI service.

## Run locally

Use Node.js **22.12+ or 24**.

~~~bash
npm ci
npm run dev
~~~

Open the URL printed by Vite. The included public registry is already configured; no environment variable, API key, backend server or contract deployment is needed to read the case studies.

For an optimized build:

~~~bash
npm test
npm run build
python3 -m http.server 8080 --directory dist
~~~

Then open http://localhost:8080. Serve the build over HTTP; do not open dist/index.html directly as a file.

## Try the application

1. Open **Automatic OPTIONS**. The blocking assertion that OPTIONS responses are disabled by default is contradicted.
2. Inspect the exact added line in **src/flask/app.py**, with its verified SHA-256 digest.
3. Open **Review history**. The initial finding was INCONCLUSIVE. A second changed file established the default as True and produced a CONTRADICTED revision.
4. Select **Python compatibility** for an advisory uncertainty, or **Runtime requirements** for two supported assertions.
5. Download an evidence bundle, search releases, inspect the evidence ledger, or save a release to your browser-local watchlist.

These are **historical case studies with illustrative assertions**. They are not quotations, promises or release announcements made by Flask or Click maintainers.

## Write through a wallet

Use an injected EIP-1193 wallet, such as a desktop extension or MetaMask's mobile browser.

1. Connect your wallet. Fund the same address with test GEN using [GenLayer Studio](https://studio.genlayer.com).
2. Select **New release** and choose a case-study template or enter your own comparison.
3. Use the full 40-character baseline and head commit hashes. Choose small public GitHub comparisons.
4. Add up to five assertions and their changed file paths. Mark the assertions that should block a release.
5. Review the immutable terms and sign the registration transaction on Studionet.
6. After finality, select **Run GenLayer audit** and sign the second transaction.
7. Inspect the finding. To contest it, select a claim, choose **Challenge with evidence**, and provide a previously unconsidered changed file from the same comparison.

The app switches to Studionet before writing, checks the connected account, tracks GenLayer finality, preserves pending transaction IDs for retry, and verifies evidence hashes before export. A no-op challenge is rejected without consuming a revision slot. Network gas may apply; the contract itself takes no deposits or payments.

To reproduce the two-step Flask example, start from the Automatic OPTIONS template. After its initial review, challenge the disabled-default claim with:

~~~text
src/flask/app.py
~~~

Reason: The default configuration explicitly sets PROVIDE_AUTOMATIC_OPTIONS to True in the same fixed comparison.

## Publish on GitHub Pages

Push the **contents** of this project folder to the root of your repository, including the hidden .github folder.

In your repository, select **Settings → Pages → Build and deployment → Source → GitHub Actions**. No root/docs folder selection is needed for this workflow. Run the **Deploy ReleaseProof to Pages** workflow, or push to main.

The workflow installs locked dependencies, runs frontend tests, builds Vite and publishes only dist. Relative asset paths work under any repository name. See [the step-by-step guide](docs/GITHUB_PAGES_HINGLISH.md).

## Tests and evidence

Frontend and wallet-unit tests:

~~~bash
npm test
~~~

Contract tests need Python 3.12 and the pinned dependencies:

~~~bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest
genvm-lint check contracts/release_proof.py
~~~

The contract suite uses the real GenVM test harness with mocked external HTTP/LLM results. It checks consensus disagreement, malformed or forged evidence, failed fetches, retries, immutability, gate precedence, bounded revisions, unchanged challenges and public callers. It is not a live-model accuracy benchmark.

Read-only live verification:

~~~bash
python test_deployed.py
~~~

This checks source bytes, the eight demo receipts and the recorded evidence history. Later valid public challenges may append revisions without invalidating the historical record.

To replay all case studies in a **new** registry:

~~~bash
python test_deployed.py --fresh --output-dir /tmp/releaseproof-demo
~~~

To point the app at the completed fresh demo, run:

~~~bash
python scripts/use_deployment.py /tmp/releaseproof-demo
~~~

To exercise the actual JavaScript SDK's injected-provider path on a separate registry:

~~~bash
python scripts/wallet_smoke.py --output-dir /tmp/releaseproof-wallet-test
~~~

These last two commands write transactions on Studionet. They generate a disposable test wallet in the specified output directory, never in the browser bundle. Do not publish private-wallet.json. The provider smoke test uses a scripted EIP-1193 signer; it does not claim to automate a real MetaMask extension.

## Contract API

| Method | Type | Purpose |
| --- | --- | --- |
| register_release(id, title, repository, base_sha, head_sha, claims_json) | Write | Freeze the release scope and original claim policy |
| audit_release(id) | Write | Fetch complete selected patches, reach consensus and store initial findings |
| challenge_claim(id, claim_id, new_paths_json, reason) | Write | Review new evidence and append a changed verdict |
| get_release_ids() | View | List the registry's release IDs |
| get_release(id) | View | Read scope, current gate, evidence and full review history |
| get_policy() | View | Read application limits and semantic scope |

Claim format:

~~~json
[
  {
    "id": "python-floor",
    "text": "The package now requires Python 3.10 or newer.",
    "blocking": true,
    "paths": ["pyproject.toml"]
  }
]
~~~

## Boundaries

ReleaseProof verifies **selected source assertions**, not security, runtime correctness, tests, deployed behavior or repository ownership. A cited changed line constrains a model's output but does not make semantic reasoning infallible.

The current prototype allows 64 releases per registry, five claims per release, six unique changed files, and two changed-verdict revisions per claim. Anyone can register or challenge. Registration can be spammed and IDs can be occupied; there is no anti-Sybil or admission mechanism. Deploy a new registry if the cap is reached. This is a development-network application, not an audited production service.

Evidence comes from GitHub's public comparison API. Rate limits, unavailable commits, incomplete/truncated patches, binary files, large comparisons and model disagreement can prevent an audit. The app clearly labels its packaged snapshot when live reads fail.

See [architecture](docs/ARCHITECTURE.md), [verification notes](docs/VERIFICATION.md), [submission copy](docs/SUBMISSION.md), and [third-party notices](THIRD_PARTY_NOTICES.md).

## Project layout

| Location | Contents |
| --- | --- |
| app/ | React UI, domain validation, SDK adapter and verified demo snapshot |
| contracts/ | Deployed ReleaseProof Intelligent Contract |
| tests/ and app-tests/ | Contract and frontend test suites |
| scripts/ | Export, configuration and live wallet test utilities |
| verification/ | Test reports, checks and public live evidence |
| docs/ | Architecture, usage, Pages instructions and submission text |
| public/ | Original logo and favicon assets |
| dist/ | Ready-built static application in the downloadable ZIP |
| .github/workflows/ | GitHub Pages deployment workflow |

MIT license for original project code. Upstream example diffs and dependencies retain their original licenses.
