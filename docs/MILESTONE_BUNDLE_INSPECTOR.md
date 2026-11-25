# Evidence Bundle Inspector milestone

## What this adds

ReleaseProof already exports portable evidence. A reviewer receiving that JSON previously had no import workflow to check its contents or discover a later evidence challenge. The new Bundle inspector completes that review path.

- Import one JSON export by file picker or drag and drop, up to 1,000,000 bytes.
- Validate the export format, Studionet network, immutable comparison and contract-shaped bounds.
- Recompute every patch, snapshot and historical evidence digest.
- Check exact changed-line witnesses, sequential append-only revisions, preserved evidence files and latest-finding consistency.
- Recompute the release gate using the original blocking/advisory policy.
- Optionally read the existing configured contract's latest-final release state and compare its immutable scope, evidence and review-history prefixes.
- Show claim-by-claim exported/current findings, additional review counts, added files and gate changes.
- Download a separate inspection report containing the exact uploaded UTF-8 file's SHA-256, byte count, local check counts and registry-check result.

## How to review it

1. Run `npm ci` and `npm run dev`, or serve the included dist/ build over HTTP.
2. On the existing release desk, use **Export evidence bundle** for a case study.
3. Open **Bundle inspector** in the sidebar and choose the downloaded JSON.
4. Expect **Bundle checks passed** and **Registry not checked**. Importing does not automatically contact an address from the file.
5. Select **Compare with finalized registry**. A current export displays **Matches finalized state**. Public challenges after export may instead produce **Newer review available**.
6. Import examples/bundle-inspector/before-challenge.json and compare it. The recorded Automatic OPTIONS initial gate is REVIEW; its stored challenge adds src/flask/app.py and changes the gate to BLOCKED. The inspector shows the changed claim and new evidence.
7. Import examples/bundle-inspector/tampered.json. Expect rejection because the patch digest no longer matches. Previous passing results and report downloads are cleared.
8. Import examples/bundle-inspector/edited-assertion.json. Local consistency passes, but registry comparison reports **Bundle differs from registry** because the assertion text is not the immutable registered claim.
9. Download the inspection report. Its registry_check explicitly records CURRENT, UPDATED, MISMATCH, UNAVAILABLE or NOT_CHECKED; local checks are a separate field.

## Outcome meanings

| Outcome | Meaning |
| --- | --- |
| Bundle checks passed | The JSON is structurally valid and internally consistent. It is not yet authenticated against the registry. |
| Matches finalized state | The release fields, evidence and history match the configured RPC's latest-final record at check time. |
| Newer review available | The imported history is a valid prefix, but the registry contains later reviews or additional evidence. |
| Bundle differs from registry | The immutable scope, stored evidence or existing review rows differ. |
| Registry check unavailable | A matching finalized record could not be established; local checks do not become a network match. |

## Integration and boundaries

The only existing frontend entry file changed is app/App.jsx, with one import, one sidebar action and one modal mount. New styles use the rp-inspector prefix. The original stylesheet, branding assets, dependency lockfile, RPC adapter, contract source, address, packaged case studies, existing export format and Pages workflow are preserved.

The inspector uses read-only get_release calls through the existing latest-final SDK adapter. A foreign-registry file can be checked locally, but cannot make this application query a different contract or RPC. Links are derived from validated repository/commit fields rather than arbitrary imported URLs.

The original export is never rewritten. A file replacement or cleared inspection invalidates in-flight work, so a delayed response cannot certify the next file.

Local hashes can be recomputed by someone editing a report; they do not prove authenticity. Registry checks trust the configured RPC. Receipt context is not independently verified. This feature does not certify software safety, GitHub ownership or model accuracy.

## Validation

Run `npm test` for the original 27 frontend/wallet tests and 39 new inspector tests. The new cases include corrupted evidence, fabricated witnesses, forged gates, edited history, oversized/invalid JSON, exact original-byte hashing, valid pre-challenge exports and self-consistent edits detected only by the registry comparison.

Run `node scripts/verify_bundle_inspector.mjs` for read-only live checks of the preserved contract source, all three recorded case studies, current live exports and the older Automatic OPTIONS review. No signed transaction is submitted.

New verification records use the bundle-inspector prefix so the project's original verification evidence remains intact. Browser visual verification depends on preview-browser access and is recorded separately from unit/component and live RPC checks.

The React DOM component suite covers import, drag and drop, stale-state clearing, current/updated/mismatched reports, foreign registries, network failures, retry, inspection download and an in-flight response arriving after file replacement. It runs in memory and makes no visual-layout claim. Its optional jsdom dependency is installed separately so package.json and package-lock.json remain unchanged:

~~~bash
npm install --prefix /tmp/releaseproof-component-qa --package-lock=false --ignore-scripts jsdom@27.2.0
RP_JSDOM_MODULE=/tmp/releaseproof-component-qa/node_modules/jsdom/lib/api.js node scripts/test_bundle_inspector_component.mjs
~~~

For this packaged milestone, 66 core tests, 14 React DOM component checks, the production build and live read-only registry checks passed. Browser visual inspection was unavailable in the preparation environment; no screenshot or pixel-equivalence result is claimed.
