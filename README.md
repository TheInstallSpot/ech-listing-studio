# ECH Listing Studio

One installable app that does both jobs: **pick condition → stamp photos →
write the eBay listing → copy it into eBay.** iPad-first, works offline once
loaded, auto-saves the current item. Branded with the official ECH assets.

This agent-ready copy adds a safe handoff queue without changing the original
Paige app. An agent can prepare research and draft listing inputs in JSON;
Paige imports the file, loads an item, chooses N1/O2/D3, and verifies the
physical item. The queue does not publish to eBay or change any eBay setting.

The queue also enforces restricted-brand authorization. AudioQuest items are
blocked unless the exact SKU appears in `authorization-registry.js`; the
approved `AUDI-PHOTON48` SKU is registered and all other AudioQuest SKUs are
denied by default.

## What's in here
- `index.html`, `styles.css`, `app.js` — the app
- `badges.js` — N1 / O2 / D3 badge images (from the Badge Stamper)
- `builder-core.js` — the eBay title + description generator (from the Listing Builder — identical output)
- `agent-queue.js` — imports researched items and exports Paige's current draft
- `authorization-registry.js` — exact-SKU approval gate for restricted brands
- `priority-queue.initial.json` — six real ECH priority SKUs, deliberately blocked on physical verification
- `prepared-items.sample.json` — one complete example for testing the handoff
- `AGENT_DATA_SCHEMA.md` — the file format an agent uses to prepare work
- `masthead.png`, `icon-*.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon-32.png` — ECH brand art
- `manifest.webmanifest`, `sw.js`, `.nojekyll`

Everything runs in the browser. No server, nothing leaves the device.

## First agent-assisted session

1. Open the app and choose **Choose approved product**.
2. Select `priority-queue.initial.json`.
3. The app loads the approved product and returns Paige to the condition step.
4. Paige selects N1, O2, or D3 and fills the physical-verification blanks.
5. The normal photo, title, HTML, and copy-to-eBay workflow continues unchanged.
6. After the listing work is finished, press **Finished with this product** to remove it from the queue.

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
