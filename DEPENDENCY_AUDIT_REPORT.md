# KTechara Website — Dependency Audit Report

**Date:** 2026-06-12  
**Scope:** Full audit of all HTML, CSS, JS files (674 HTML pages, 8,000+ total files)  
**Goal:** Make website fully self-contained, zero dependency on advania.co.uk for assets/scripts

---

## Executive Summary

| Category | Before | After | Action |
|----------|--------|-------|--------|
| Google Tag Manager (tracking) | 72 files | 0 | ✅ Removed |
| Adobe Typekit CSS (external) | 51 files | 0 | ✅ Replaced with local copy |
| Typekit Font Files | 0 local | 96 files | ✅ Downloaded locally |
| gmpg.org XFN profile | 615 files | 0 | ✅ Removed |
| wpenginepowered.com staging URLs | 622 files | 0 | ✅ Replaced with relative paths |
| HubSpot cookie-banner script | 23 files | 0 | ✅ Removed |
| HubSpot hs-fs/hubfs images (src=) | 48 unique | 0 external | ✅ Downloaded + updated (48 images) |
| HubSpot CSS background images | 4 files | 0 external | ✅ Downloaded + updated (3 images) |
| **Total files modified** | — | **663** | ✅ Complete |

---

## Section 1: Removed Dependencies

### 1.1 Google Tag Manager (GTM)
- **ID:** GTM-K9XTLGFS (WordPress site), GTM-TLBFGZV4 (stray Blazor page)
- **Files affected:** 72 HTML files
- **Pattern removed:** `<!-- Google Tag Manager --> <script>...</script> <!-- End Google Tag Manager -->`  
  and `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-..."></iframe></noscript>`
- **Risk:** None — analytics/tracking only, zero functional impact
- **Justification:** Third-party tracking service, no site functionality depends on it

### 1.2 Adobe Typekit / Adobe Fonts
- **URL removed:** `https://use.typekit.net/wwb1uys.css`
- **Files affected:** 51 HTML files
- **Action taken:**
  - Downloaded the Typekit CSS locally
  - Downloaded all 96 font files (woff2/woff/otf variants for adelle, adelle-sans, adelle-sans-ultra-thin, adelle-ultrathin)
  - Saved to: `wp-content/themes/hello-theme-child-master/fonts/`
  - Updated each HTML file with correct depth-relative local path
- **Risk:** None — identical fonts, same CSS, locally served
- **Note:** Removed the `@import url("https://p.typekit.net/...")` tracking import from the CSS; this was Adobe's font-usage analytics, not a functional requirement

### 1.3 gmpg.org XFN Profile Link
- **URL removed:** `https://gmpg.org/xfn/11`
- **Files affected:** 615 HTML files
- **Pattern:** `<link rel="profile" href="https://gmpg.org/xfn/11" />`
- **Risk:** None — WordPress boilerplate metadata, zero visual/functional impact

### 1.4 wpenginepowered.com Staging URLs
- **Files affected:** 622 HTML files
- **Replacements made:**

| Old URL | New URL |
|---------|---------|
| `https://advaniauk2stg.wpenginepowered.com/technology-sourcing/` | `/technology-sourcing/` |
| `https://advaniauk2stg.wpenginepowered.com/our-solutions/` | `/our-solutions/` |
| `https://advaniauk2stg.wpenginepowered.com/partners` | `/partners/` |
| `https://advaniauk[12]stg.wpenginepowered.com/?post_type=insights&...` | `/insights/` |
| `https://advaniacouk.wpengine.com/` | `/` |

- **Risk:** None — staging environment URLs replaced with equivalent local paths

### 1.5 HubSpot Cookie-Banner Auto-Blocking Script
- **URL removed:** `https://info.advania.co.uk/_hcms/cookie-banner/auto-blocking.js?portalId=3017156&domain=info.advania.co.uk`
- **Files affected:** 23 HTML files (e-books, webinars, microsoft-workshops, workshop, reports-research)
- **Risk:** None — this was HubSpot's cookie consent manager for info.advania.co.uk, not the current site
- **Note:** The pages these appear on are HubSpot-hosted landing pages (e-books, engagement forms) cloned into the WordPress site. The cookie banner tied to info.advania.co.uk's HubSpot portal has no effect here.

### 1.6 HubSpot hs-fs/hubfs Images
- **Source:** `https://info.advania.co.uk/hs-fs/hubfs/[image files]`
- **Images downloaded:** 51 total (48 from src= attributes + 3 CSS background-image)
- **Saved to:** `wp-content/uploads/hubspot/`
- **Files updated:** 27 HTML files
- **Risk:** None — identical images served locally

---

## Section 2: Retained External Dependencies

These were intentionally kept because removing them would break functionality.

### 2.1 HubSpot Forms Embed Script
- **URL:** `https://js.hsforms.net/forms/embed/v2.js`
- **Files:** 382 HTML files
- **Purpose:** Loads embedded HubSpot contact/lead-generation forms throughout the site
- **Risk of removal:** HIGH — all contact forms and lead-capture forms would break
- **Action:** Kept as-is. Forms require HubSpot backend; a local replacement is not possible without a server-side CRM integration.

### 2.2 HubSpot Forms API (info.advania.co.uk/_hcms/forms/v2.js)
- **URL:** `https://info.advania.co.uk/_hcms/forms/v2.js`
- **Files:** 14 HTML files (HubSpot landing pages)
- **Purpose:** Form loading script for HubSpot-originated landing pages
- **Action:** Kept. Removing would break form submissions on those pages.

### 2.3 community.advania.co.uk — Navigation Links
- **Files:** 616 HTML files
- **Purpose:** Navigation links to the Advania community portal (legitimate external destination)
- **Action:** Kept — these are deliberate outbound links to an external platform the user owns

### 2.4 belong.advania.co.uk — Careers Links
- **Files:** 447 HTML files  
- **Purpose:** Careers/early-careers portal links in navigation and page content
- **Action:** Kept — legitimate outbound links to careers platform

### 2.5 YouTube Video Links/Embeds
- **Files:** 24 HTML files
- **Purpose:** Embedded YouTube videos and links to video content
- **Action:** Kept — video content links, no alternative

### 2.6 advania-uk.wistia.com — Video Hosting
- **Files:** 12 HTML files
- **Purpose:** Wistia-hosted video players (company explainer videos)
- **Action:** Kept — video platform, no local alternative

### 2.7 LinkedIn Profile Links
- **Files:** 32 HTML files
- **Purpose:** Leadership and team member LinkedIn profile links
- **Action:** Kept — legitimate external profile links

### 2.8 Twitter/X Social Links
- **Purpose:** Social media links (twitter.com/Advania_UK)
- **Action:** Kept — legitimate social media links

---

## Section 3: advania.co.uk Content Links (Navigation/Href)

These are `<a href="...">` navigation links pointing to advania.co.uk pages. They are **intentional outbound links** to content/pages that exist on the original domain:

- `https://advania.co.uk/contact-us/` — Contact page
- `https://advania.co.uk/privacy-policy/` — Privacy policy
- `https://advania.co.uk/terms-of-use` — Terms of use
- `https://info.advania.co.uk/ebook/...` — Downloadable e-books (external)
- `https://info.advania.co.uk/engagement/...` — Engagement/workshop sign-up pages

**Action:** Kept — these are content hyperlinks, not asset/script dependencies. The site renders fully without them; they simply link out to external content.

---

## Section 4: Local Asset Inventory

### New Files Created

| Path | Contents |
|------|----------|
| `wp-content/themes/hello-theme-child-master/fonts/typekit.css` | Local Typekit CSS |
| `wp-content/themes/hello-theme-child-master/fonts/*.woff2` (32 files) | Adelle/Adelle-Sans woff2 fonts |
| `wp-content/themes/hello-theme-child-master/fonts/*.woff` (32 files) | Adelle/Adelle-Sans woff fonts |
| `wp-content/themes/hello-theme-child-master/fonts/*.otf` (32 files) | Adelle/Adelle-Sans OTF fonts |
| `wp-content/uploads/hubspot/` (51 images) | HubSpot marketing/icon images |

### Scripts Created (Cleanup Tools)
| File | Purpose |
|------|---------|
| `download_typekit.js` | Downloaded Typekit fonts |
| `cleanup_dependencies.js` | Master cleanup script |
| `download_hubspot_images.js` | Downloaded HubSpot images |
| `download_typekit_fonts.py` | Python version (unused — no Python installed) |

---

## Section 5: Verification Checklist

| Check | Result |
|-------|--------|
| `googletagmanager.com` in HTML | ✅ 0 files |
| `use.typekit.net` in HTML | ✅ 0 files |
| `p.typekit.net` in HTML/CSS | ✅ 0 files |
| `gmpg.org` in HTML | ✅ 0 files |
| `wpenginepowered.com` in HTML | ✅ 0 files |
| `_hcms/cookie-banner` scripts | ✅ 0 files |
| `hs-fs/hubfs` image references | ✅ 0 files |
| Local typekit.css links | ✅ 51 files with correct depth-relative paths |
| Font files available locally | ✅ 96 files (woff2/woff/otf) |
| HubSpot images available locally | ✅ 51 images in `wp-content/uploads/hubspot/` |
| Broken navigation (wpenginepowered URLs) | ✅ Fixed → relative local paths |
| Forms functional | ✅ HubSpot form scripts retained |
| Font rendering | ✅ Adelle/Adelle-Sans served locally |
| JavaScript broken | ✅ No JS removed except GTM tracking |
| CSS layout intact | ✅ No CSS changed except local path updates |

---

## Section 6: Remaining External Requests at Runtime

When a user loads this site, these external requests will still occur (all are intentional):

| Domain | Purpose | Files | Notes |
|--------|---------|-------|-------|
| `js.hsforms.net` | HubSpot forms | 382 pages | Required for contact forms |
| `info.advania.co.uk/_hcms/forms/v2.js` | HubSpot LP forms | 14 pages | Required for landing page forms |
| `community.advania.co.uk` | Navigation links | 616 pages | Outbound link (not loaded) |
| `belong.advania.co.uk` | Careers links | 447 pages | Outbound link (not loaded) |
| `www.youtube.com` | Video embeds | 24 pages | Video content |
| `advania-uk.wistia.com` | Video embeds | 12 pages | Video content |
| `www.linkedin.com` | Profile links | 32 pages | Outbound link (not loaded) |

**No external CSS, fonts, tracking scripts, or image assets are loaded from advania.co.uk.**

---

*Report generated: 2026-06-12*
