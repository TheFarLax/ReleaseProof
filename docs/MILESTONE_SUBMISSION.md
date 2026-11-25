# Milestone submission copy

## Title

ReleaseProof — Evidence Bundle Inspector and Finalized-State Freshness Checks

## Changes and improvements

Added an Evidence Bundle Inspector that lets reviewers import an existing ReleaseProof export, validate it locally and compare it with the same deployed GenLayer contract's finalized release state. It checks patch and snapshot hashes, historical evidence subsets, exact changed-line witnesses, sequential revisions, latest findings and release-gate consistency. It then distinguishes a current report, a valid older report superseded by evidence challenges, and an edited report that differs from the registry.

Reviewers can inspect claim-by-claim verdict changes, additional reviews and newly considered evidence files, then download an inspection report with the original file's SHA-256 and explicit local/network results. The workflow requires no wallet or transaction. Existing contract source/address, release registration, audits, challenges, exports, branding, dependencies and GitHub Pages configuration are preserved.

Validation includes all 27 existing frontend/wallet tests, 39 new inspector tests and read-only live checks against all three existing onchain case studies. Included fixtures demonstrate current, pre-challenge, corrupted and self-consistently edited reports. The pre-challenge fixture reconstructs recorded initial history and is clearly identified as historical.

## GitHub evidence files

- Main implementation: https://github.com/TheFarLax/ReleaseProof/blob/main/app/bundle-inspector.js
- User interface: https://github.com/TheFarLax/ReleaseProof/blob/main/app/BundleInspector.jsx
- Test coverage: https://github.com/TheFarLax/ReleaseProof/blob/main/app-tests/bundle-inspector.test.js
- Live verification: https://github.com/TheFarLax/ReleaseProof/blob/main/verification/bundle-inspector-live.json
- Review guide: https://github.com/TheFarLax/ReleaseProof/blob/main/docs/MILESTONE_BUNDLE_INSPECTOR.md

These new file URLs become available after the milestone patch is committed and pushed to main. They are prepared evidence links, not a claim that this ZIP has already been pushed.

Existing contract: https://explorer-studio.genlayer.com/address/0xA2d587FE67B4866079e14a058aB6822bbb56f5D0
