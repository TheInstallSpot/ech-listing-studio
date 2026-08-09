# ECH Listing Studio

One installable app that does both jobs: **pick condition → stamp photos →
write the eBay listing → copy it into eBay.** iPad-first, works offline once
loaded, auto-saves the current item. Branded with the official ECH assets.

## What's in here
- `index.html`, `styles.css`, `app.js` — the app
- `badges.js` — N1 / O2 / D3 badge images (from the Badge Stamper)
- `builder-core.js` — the eBay title + description generator (from the Listing Builder — identical output)
- `masthead.png`, `icon-*.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon-32.png` — ECH brand art
- `manifest.webmanifest`, `sw.js`, `.nojekyll`

Everything runs in the browser. No server, nothing leaves the device.

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
