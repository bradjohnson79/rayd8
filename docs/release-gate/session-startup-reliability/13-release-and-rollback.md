# 13 — Release and Rollback

Branch: `fix/session-startup-reliability`  
Baseline tag: `baseline/session-startup-reliability-pre`

Rollback: revert merge commit or reset to baseline tag. No DB migration to roll back. Operator may stop using `sessions:reconcile --apply`.
