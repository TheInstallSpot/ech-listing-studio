# ECH prepared-item schema v1

The queue accepts one item object, an array of item objects, or an object with an `items` array.

Core fields: `sku`, `productId`, `brand`, `part`, `what`, `sold`, `title`, `mounting`, `hook`, `box`, `spec`, `ver`, `pdesc`, `targetPrice`, `shippingPlan`, and `researchNotes`.

- `box` and `ver` are arrays of strings.
- `spec` is an array of `[name, value]` pairs.
- Condition is intentionally not required. Paige must choose `N1`, `O2`, or `D3` from the physical item.
- Agent-prepared facts remain drafts until Paige verifies the item and Lee approves price/shipping exceptions.
- Restricted brands are checked before import. AudioQuest requires exact-SKU approval; the registry currently permits only `AUDI-PHOTON48`. Unregistered AudioQuest SKUs are rejected and never enter Paige's queue.
