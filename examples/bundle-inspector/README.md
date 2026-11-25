# Inspector review examples

| File | Purpose | Expected result |
| --- | --- | --- |
| current.json | Export of the project's original recorded Automatic OPTIONS snapshot | Local checks pass; registry comparison is CURRENT unless later public challenges were added |
| before-challenge.json | Historical reconstruction using the original recorded initial review rows and their exact evidence subset | Local checks pass; registry comparison reports UPDATED |
| tampered.json | Deliberately changed patch without matching digests | Import is rejected |
| edited-assertion.json | Deliberately edited assertion text with otherwise consistent evidence | Local checks pass; registry comparison reports MISMATCH |

The current and historical examples use the existing published onchain case-study data. The before-challenge file is a reconstruction for review, not a claim that an export file was captured at that earlier time. The tampered and edited fixtures are intentional negative test inputs, not valid findings or statements by upstream maintainers.
