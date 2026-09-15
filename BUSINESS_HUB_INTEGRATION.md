# ECH Business Hub listing-review connection

This is the implementation contract for the separate Business Hub project.
It preserves the rule that Paige prepares work and Lee alone approves eBay
publication.

## Paige's finished workflow

1. The Business Hub assigns one approved product to Paige's queue.
2. Paige physically chooses `N1`, `O2`, or `D3`.
3. Paige adds the exact photos.
4. Listing Studio normalizes clean JPEGs and validates the listing packet.
5. Paige presses **Send to Lee for approval**.
6. The Business Hub shows an unpublished review card to Lee.
7. Only Lee's separate **Approve & Publish** action may call eBay publication.

## Secure review receiver

Create an HTTPS `POST` endpoint for multipart form data. Put its public URL in
`review-config.js` as `window.ECH_REVIEW_ENDPOINT`. Never put an eBay client
secret, access token, or refresh token in Listing Studio.

The request contains:

- `listing`: one JSON file using `schemaVersion: 1` and
  `reviewStatus: awaiting_lee_approval`;
- `photos`: one or more plain JPEG files in eBay display order;
- `Authorization: Bearer <single-use review token>`.

The Business Hub must create the review token when it queues the product. The
token must be short-lived, single-use, and limited to that exact queued item.
Reject a missing, expired, reused, or wrong-SKU token. Do not return the token
to the browser after it is used.

Validate again on the server: exact SKU authorization, condition code, title
length, sale unit, verified unit cost, available quantity, fulfillment type,
photo count/type/size, and required description facts. Client checks improve
Paige's experience but are not a security boundary.

Return success only after the review record and every photo are safely stored.
A useful response is `{ "reviewId": "...", "status": "awaiting_lee_approval" }`.

## eBay connection

Keep eBay Production credentials and OAuth refresh tokens only on the secure
server. Upload accepted images with Media API `createImageFromFile` and retain
the returned eBay Picture Services URLs. Build or update the inventory item and
an unpublished offer with the Inventory API.

Do not call `publishOffer` from Paige's request. Lee's authenticated approval
screen must show condition, exact sale unit, cost, quantity, price, fulfillment,
photos, title, warnings, and contribution before enabling publication. Log the
approver, time, review ID, offer ID, listing ID, and final submitted values.

An Inventory API unpublished offer is not guaranteed to appear in Seller Hub's
ordinary Drafts screen. The Business Hub review card is therefore the durable
approval surface.

Official eBay references:

- Media API images: https://developer.ebay.com/api-docs/sell/static/inventory/managing-image-media.html
- Managing unpublished offers: https://developer.ebay.com/api-docs/sell/static/inventory/managing-offers.html
- Seller OAuth authorization: https://developer.ebay.com/develop/guides/sell/authorization
