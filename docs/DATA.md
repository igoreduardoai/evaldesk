# Data used by EvalDesk

EvalDesk ships two suites. The app labels each one in the header and in the suite list.

## 1. Real public data: ABCD (wrong-size returns)

- **Source:** ABCD, the Action-Based Conversations Dataset, by ASAPP Research (Chen et al., NAACL 2021). <https://github.com/asappresearch/abcd>
- **License:** MIT (Copyright (c) 2021 ASAPP Research). The license text is in the repository above.
- **What it is:** more than 10,000 customer-service chats written by people. Crowdworkers role-played the agent and the customer, and the agent followed a written guideline. Customer names, emails, order IDs and addresses are fictional scenario data from the dataset, not real customers.
- **What EvalDesk uses:** 12 chats from the `test` and `dev` splits of `abcd_v1.1.json`, subflow `return_size` ("Product Defect > Return Due to Size"). The chat text is copied verbatim, including the agent's logged actions (lines starting with `[action]`). The suite policy is the dataset's own guideline for that subflow, copied verbatim from `guidelines.json`.
- **How the 12 were picked:** the shortest chats per membership level that had all logged steps (7), plus the shortest ones missing the "Membership Privileges" action (4) or the "Validate Purchase" action (1). This mix was chosen so that a step checklist and an outcome-based reviewer can disagree.
- **Not used:** the dataset's annotations are not EvalDesk verdicts. ABCD does not label whether an agent followed the policy. The PASS/FAIL verdicts below come from this project.

### Verdicts in the demo

There are three graders:

1. **The EvalDesk agent** (an LLM) proposes a verdict with an exact quote from the chat as evidence.
2. **The primary human reviewer** approves or overrules. In the recorded demo the clicks were scripted, and the verdicts are the ones in the table below. The project author picked them by reading each chat against the guideline. They are listed here so anyone can disagree.
3. **The "simulated reviewer"** is a second reviewer that is a deterministic checklist (`abcdChecklist` in `server/lib/grading.ts`), not a person. It fails a chat when the action log is missing Pull up Account, Validate Purchase, or Membership Privileges. EvalDesk reports its agreement with the human as Cohen's kappa. A real second person can also add reviews in the UI; the app tags those as `human`.

| Case | Source | Primary human verdict | Note |
|---|---|---|---|
| ABCD test #8810 (guest) | `abcd_v1.1.json test convo_id=8810` | PASS | Guest, no receipt: denial follows the guest rule. |
| ABCD dev #7671 (bronze) | `abcd_v1.1.json dev convo_id=7671` | FAIL | Bronze past 90 days, but the agent never asked for a receipt or original packaging, which would make it eligible. |
| ABCD dev #6252 (gold) | `abcd_v1.1.json dev convo_id=6252` | PASS | Gold: unlimited returns. Purchase validated with all three fields; outcome correct. |
| ABCD test #6274 (guest) | `abcd_v1.1.json test convo_id=6274` | PASS | Guest, no receipt: denial follows the guest rule. |
| ABCD dev #6100 (silver) | `abcd_v1.1.json dev convo_id=6100` | PASS | Silver within 6 months: return processed correctly. |
| ABCD test #8141 (gold) | `abcd_v1.1.json test convo_id=8141` | PASS | Gold: correct outcome, every step logged. |
| ABCD dev #8823 (bronze) | `abcd_v1.1.json dev convo_id=8823` | PASS | Bronze past 90 days but has the receipt: eligible, processed correctly. |
| ABCD test #10124 (gold) | `abcd_v1.1.json test convo_id=10124` | PASS | Gold asked in chat; outcome correct even though the membership step was not clicked. |
| ABCD test #9268 (bronze) | `abcd_v1.1.json test convo_id=9268` | FAIL | Never checked membership or date, no order ID, and offered a refund method instead of a return. |
| ABCD dev #4523 (silver) | `abcd_v1.1.json dev convo_id=4523` | PASS | Silver within 6 months: eligible and processed. |
| ABCD dev #4899 (gold) | `abcd_v1.1.json dev convo_id=4899` | PASS | Gold: unlimited returns, processed correctly. |
| ABCD test #3764 (gold) | `abcd_v1.1.json test convo_id=3764` | FAIL | Verified identity instead of validating the purchase; first order update was empty. |

## 2. Synthetic data: "Refund bot v3"

Twelve answers from a fictional store's refund bot (Northwind Outfitters), graded against a 5-rule refund policy. All of it was written for this demo (`server/lib/demo-suite.ts`). None of it is real.
