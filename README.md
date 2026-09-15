# ECH Listing Studio

One installable app that does both jobs: **pick condition → prepare clean photos →
check the eBay listing → send it to Lee.** iPad-first, works offline once
loaded, auto-saves the current item, and uses the official ECH assets.

An agent can prepare research and draft listing inputs for Paige's queue.
Paige loads an approved item, chooses N1/O2/D3 from the physical item, adds
photos, and sends a review to Lee. The queue does not publish to eBay or
change any eBay setting.

Photos are normalized into plain RGB JPEGs, scaled down to 2000 pixels on the
long side when needed, and named from the SKU. The app never adds a badge,
logo, text, border, or watermark to an eBay photo. Images below the recommended
1600-pixel long side remain usable but show a clear warning.

The queue also enforces restricted-brand authorization. AudioQuest items are
blocked unless the exact SKU appears in `authorization-registry.js`; the
approved `AUDI-PHOTON48` SKU is registered and all other AudioQuest SKUs are
denied by default.

## What's in here
- `index.html`, `styles.css`, `app.js` — the app
- `builder-core.js` — the ECH-standard eBay title and branded description generator
- `agent-queue.js` — loads researched items and sends Paige's review
- `review-config.js` — the public secure Business Hub receiver URL; never stores eBay secrets
- `BUSINESS_HUB_INTEGRATION.md` — the secure receiver and Lee-approval contract for the dashboard project
- `authorization-registry.js` — exact-SKU approval gate for restricted brands
- `priority-queue.initial.json` — six real ECH priority SKUs, deliberately blocked on physical verification
- `prepared-items.sample.json` — one complete example for testing the handoff
- `AGENT_DATA_SCHEMA.md` — the file format an agent uses to prepare work
- `masthead.png`, `icon-*.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon-32.png` — ECH brand art
- `manifest.webmanifest`, `sw.js`, `.nojekyll`

The secure Business Hub receiver is configured. Lee’s one-time device setup
link connects the approved-work queue and carries a short-lived, single-use
review token for each exact SKU. **Send to Lee** posts the listing JSON and
ordered JPEGs to the secure receiver. If the receiver is intentionally removed,
the app falls back to the Share sheet or a local save. It never publishes to eBay.

## First agent-assisted session

1. Lee opens **Set up Paige’s device** once from the Business Hub.
2. Paige taps **Sync approved work** and chooses a product Lee approved.
3. The app loads the product and returns Paige to the condition step.
4. Paige selects N1, O2, or D3 and fills the physical-verification blanks.
5. Add the exact-item photos. The app prepares clean `.jpeg` files automatically.
6. Press **Send to Lee for approval**. Nothing is published to eBay.
7. A successful submission leaves Paige’s queue and appears in Lee’s unpublished review inbox.

Prices in the starter queue are references to the audited current ECH prices,
not automatic pricing instructions. Lee approves price and shipping; Paige
verifies the actual unit before anything is published.

## Host it on GitHub Pages

**Option A — website upload (no terminal):**
1. On github.com create a new repo, e.g. `ech-listing-studio` (Public).
2. Click **Add file → Upload files**, drag in *all* the files from this folder
   (keep them at the repo root), and **Commit**.
3. Repo **Settings → Pages** → *Build and deployment* → Source = **Deploy from a branch**,
   Branch = **main**, folder = **/(root)** → **Save**.
4. Wait ~1 minute. Your URL appears at the top of the Pages screen:
   `https://<your-user>.github.io/ech-listing-studio/`

**Option B — command line:**
```
cd ech-listing-studio            # this folder
git init && git add . && git commit -m "ECH Listing Studio"
git branch -M main
git remote add origin https://github.com/<your-user>/ech-listing-studio.git
git push -u origin main
```
Then set **Settings → Pages → main → /(root)**.

The included `.nojekyll` file tells GitHub Pages to serve every file as-is.
All paths in the app are relative, so it works under the `/ech-listing-studio/`
sub-path with no changes.

## Put it on Paige's iPad
1. Open the Pages URL in **Safari**.
2. **Share → Add to Home Screen → Add.**
3. It now opens like an app, full screen, offline, with the ECH icon.

(On a PC: open the URL in Chrome/Edge and click **Install** in the address bar.)

## Updating later
Change any file, then bump the cache name in `sw.js` (`ech-studio-v1` →
`ech-studio-v2`) so devices pull the new version. Re-commit / re-upload.
