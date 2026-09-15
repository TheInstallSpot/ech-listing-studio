# ECH prepared-item schema v1

The queue accepts one item object, an array of item objects, or an object with an `items` array.

Core fields: `sku`, `productId`, `brand`, `part`, `what`, `sold`, `title`, `mounting`, `hook`, `box`, `spec`, `ver`, `pdesc`, `targetPrice`, `shippingPlan`, `researchNotes`, `unitCost`, `availableQuantity`, `fulfillment`, `isPassive`, `compatibilityNote`, `catalogNote`, `ebayCategoryId`, `ebayCategoryName`, `ebayCategoryPath`, and `ebayCategoryVerifiedAt`.

- `box` and `ver` are arrays of strings.
- `spec` is an array of `[name, value]` pairs.
- `sold` must be `Each`, `Pair of 2`, `Set of N`, or `N-Pack` and must match the price, cost, stock, photos, and box contents.
- `unitCost` is ECH's verified cost for one sellable listing unit. It is carried privately and is not shown in Paige's screen.
- `availableQuantity` counts sellable listing units, not loose pieces or cartons.
- `fulfillment` must be `distributor`, `ech`, or `pickup`.
- `isPassive` must be `true` or `false` for speakers. Listing Studio automatically adds the passive-speaker buyer protection when it is true.
- `compatibilityNote` and `catalogNote` are optional verified buyer guidance prepared before Paige receives the item.
- `ebayCategoryId` must be the exact current eBay US leaf category selected from the Taxonomy API. Its name, full path, and verification time travel with the item and are rechecked before offer preparation.
- Condition is intentionally not required. Paige must choose `N1`, `O2`, or `D3` from the physical item.
- Agent-prepared facts remain drafts until Paige verifies the item and Lee approves price/shipping exceptions.
- Restricted brands are checked before import. AudioQuest requires exact-SKU approval. The registry permits `AUDI-PHOTON48` plus only the approved warehouse-batch SKUs `AUDI-PQ303-BSTOCK` and `AUDI-PQ303-DEMO`; it does not grant broad PowerQuest or AudioQuest approval.
