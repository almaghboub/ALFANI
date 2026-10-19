---
name: Bulk price confirmation safety
description: Safety tradeoffs for percentage-based selling-price increases.
---

Bulk price confirmations are short-lived and single-use. Require a new preview after an ambiguous failure or server restart; do not automatically retry a price increase.

**Why:** Percentage increases compound. Retrying a successful-but-unacknowledged operation could increase prices twice. The selected tradeoff favors rejecting a confirmation over risking a duplicate increase.

**How to apply:** Preserve fail-closed behavior when adding retries, multiple server instances, or durable confirmation storage. Multi-instance support needs shared single-use confirmation state, not independent per-instance retries.
