---
name: Bulk price confirmation safety
description: Safety tradeoffs for percentage-based selling-price adjustments.
---

Bulk price confirmations are short-lived and single-use. Require a new preview after an ambiguous failure or server restart; do not automatically retry an increase or decrease.

**Why:** Percentage adjustments compound. Retrying a successful-but-unacknowledged operation could increase or decrease prices twice. The selected tradeoff favors rejecting a confirmation over risking a duplicate adjustment.

**How to apply:** Preserve fail-closed behavior when adding retries, multiple server instances, or durable confirmation storage. Multi-instance support needs shared single-use confirmation state, not independent per-instance retries.
