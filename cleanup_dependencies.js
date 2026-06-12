#!/usr/bin/env node
/**
 * Master dependency cleanup script for KTechara website.
 *
 * Operations performed on every HTML file:
 *
 * 1. REMOVE - Google Tag Manager script blocks (analytics/tracking)
 * 2. REMOVE - GTM noscript iframe blocks
 * 3. REMOVE - gmpg.org XFN profile link (harmless metadata, unnecessary external request)
 * 4. REMOVE - HubSpot cookie-banner auto-blocking script (info.advania.co.uk/_hcms/cookie-banner)
 * 5. REPLACE - wpenginepowered.com staging URLs → relative local paths
 * 6. REPLACE - https://use.typekit.net/wwb1uys.css → local path (computed per file depth)
 * 7. KEEP   - community.advania.co.uk links (external community, legitimate navigation)
 * 8. KEEP   - belong.advania.co.uk links (external careers site, legitimate navigation)
 * 9. KEEP   - info.advania.co.uk content links (ebooks, engagement pages - external content)
 * 10. KEEP  - HubSpot form embeds (js.hsforms.net) - forms require HubSpot backend; removing would break functionality
 * 11. KEEP  - YouTube, Vimeo, Wistia video links (content)
 * 12. KEEP  - LinkedIn profile links (content)
 * 13. KEEP  - Twitter/X links (social media, content)
 *
 * Staging URL replacements (wpenginepowered):
 *   https://advaniauk2stg.wpenginepowered.com/technology-sourcing/ → /technology-sourcing/
 *   https://advaniauk2stg.wpenginepowered.com/our-solutions/       → /our-solutions/
 *   https://advaniauk2stg.wpenginepowered.com/partners             → /partners/
 *   https://advaniauk1stg.wpenginepowered.com/?post_type=insights& → /insights/
 *   https://advaniauk2stg.wpenginepowered.com/?post_type=insights& → /insights/
 *   https://advaniacouk.wpengine.com/...                           → relative path
 *
 * Note: advania.co.uk links in page CONTENT (hrefs) are left as-is since:
 *   - They are navigational links to the original site (expected for a cloned/rebranded site)
 *   - The pages they point to may not exist locally
 *   - Changing them risks breaking navigation
 *   The one exception is wpenginepowered.com staging URLs which are clearly wrong.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ─── Patterns to REMOVE completely ──────────────────────────────────────────

// Google Tag Manager inline script block
// Pattern: <!-- Google Tag Manager --> ... <!-- End Google Tag Manager -->
const GTM_SCRIPT_PATTERN = /<!--\s*Google Tag Manager\s*-->\s*<script[\s\S]*?<\/script>\s*<!--\s*End Google Tag Manager\s*-->/gi;

// GTM noscript fallback
// Pattern: <!-- Google Tag Manager (noscript) --> <noscript>...</noscript> <!-- End Google Tag Manager (noscript) -->
const GTM_NOSCRIPT_PATTERN = /<!--\s*Google Tag Manager \(noscript\)\s*-->\s*<noscript>[\s\S]*?<\/noscript>\s*<!--\s*End Google Tag Manager \(noscript\)\s*-->/gi;

// GTM noscript without comment wrappers (found in some files)
const GTM_NOSCRIPT_RAW = /<noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-[^"]*"[^>]*><\/iframe><\/noscript>\n?/gi;

// GTM inline script without comments (some pages have it inline)
// Matches: <script>(function(w,d,s,l,i){...googletagmanager.com...})(window...)</script>
const GTM_INLINE_PATTERN = /<script>\s*\(function\(w,d,s,l,i\)\{[\s\S]*?googletagmanager\.com[\s\S]*?\}\)\(window[\s\S]*?<\/script>\n?/gi;

// gmpg.org XFN profile link
const GMPG_PATTERN = /<link rel="profile" href="https:\/\/gmpg\.org\/xfn\/11"[^>]*\/?>\n?/gi;

// HubSpot cookie-banner auto-blocking script (info.advania.co.uk/_hcms/cookie-banner/...)
const HS_COOKIE_BANNER_PATTERN = /<script[^>]*src="https:\/\/info\.advania\.co\.uk\/_hcms\/cookie-banner\/auto-blocking\.js[^"]*"[^>]*><\/script>\n?/gi;

// ─── Staging URL replacements ─────────────────────────────────────────────────

const STAGING_REPLACEMENTS = [
  // technology-sourcing
  [/https:\/\/advaniauk2stg\.wpenginepowered\.com\/technology-sourcing\//g, '/technology-sourcing/'],
  // our-solutions
  [/https:\/\/advaniauk2stg\.wpenginepowered\.com\/our-solutions\//g, '/our-solutions/'],
  // partners
  [/https:\/\/advaniauk2stg\.wpenginepowered\.com\/partners\b/g, '/partners/'],
  // insights (with post_type query)
  [/https:\/\/advaniauk[12]stg\.wpenginepowered\.com\/\?post_type=insights[^"']*/g, '/insights/'],
  // advaniacouk.wpengine.com catch-all (redirect to root)
  [/https:\/\/advaniacouk\.wpengine\.com\//g, '/'],
  // any remaining wpenginepowered.com URLs - replace with root
  [/https:\/\/advania[a-z0-9]*\.wpenginepowered\.com\//g, '/'],
];

// ─── Typekit replacement ──────────────────────────────────────────────────────

const TYPEKIT_EXTERNAL = 'https://use.typekit.net/wwb1uys.css';
const TYPEKIT_LOCAL_FROM_ROOT = 'wp-content/themes/hello-theme-child-master/fonts/typekit.css';

// ─── Utilities ───────────────────────────────────────────────────────────────

function getDepth(filePath) {
  // Count how many directory levels deep the file is relative to ROOT
  const rel = path.relative(ROOT, filePath);
  const parts = rel.split(path.sep);
  return parts.length - 1; // -1 because parts includes filename
}

function getTypekitLocalPath(filePath) {
  const depth = getDepth(filePath);
  if (depth === 0) return TYPEKIT_LOCAL_FROM_ROOT;
  return '../'.repeat(depth) + TYPEKIT_LOCAL_FROM_ROOT;
}

function findHtmlFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip .git directory
      if (entry.name === '.git') continue;
      results.push(...findHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Per-file processing ─────────────────────────────────────────────────────

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  const changes = [];

  // 1. Remove GTM script block (with comments)
  const beforeGtmScript = content;
  content = content.replace(GTM_SCRIPT_PATTERN, '');
  if (content !== beforeGtmScript) changes.push('Removed GTM script block (with comments)');

  // 2. Remove GTM noscript block (with comments)
  const beforeGtmNoscript = content;
  content = content.replace(GTM_NOSCRIPT_PATTERN, '');
  if (content !== beforeGtmNoscript) changes.push('Removed GTM noscript block (with comments)');

  // 3. Remove GTM noscript raw (without comment wrappers)
  const beforeGtmNoscriptRaw = content;
  content = content.replace(GTM_NOSCRIPT_RAW, '');
  if (content !== beforeGtmNoscriptRaw) changes.push('Removed GTM noscript iframe');

  // 4. Remove GTM inline script (without comments)
  const beforeGtmInline = content;
  content = content.replace(GTM_INLINE_PATTERN, '');
  if (content !== beforeGtmInline) changes.push('Removed GTM inline script block');

  // 5. Remove gmpg.org profile link
  const beforeGmpg = content;
  content = content.replace(GMPG_PATTERN, '');
  if (content !== beforeGmpg) changes.push('Removed gmpg.org XFN profile link');

  // 6. Remove HubSpot cookie-banner script
  const beforeHsCookie = content;
  content = content.replace(HS_COOKIE_BANNER_PATTERN, '');
  if (content !== beforeHsCookie) changes.push('Removed HubSpot cookie-banner auto-blocking script');

  // 7. Replace staging URLs
  for (const [pattern, replacement] of STAGING_REPLACEMENTS) {
    const before = content;
    content = content.replace(pattern, replacement);
    if (content !== before) changes.push(`Replaced staging URL → ${replacement}`);
  }

  // 8. Replace Typekit external link with local path
  if (content.includes(TYPEKIT_EXTERNAL)) {
    const localPath = getTypekitLocalPath(filePath);
    content = content.replace(
      new RegExp(`href="${TYPEKIT_EXTERNAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
      `href="${localPath}"`
    );
    changes.push(`Replaced Typekit external CSS → ${localPath}`);
  }

  // Write back only if changed
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return changes;
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('=== KTechara Dependency Cleanup ===\n');
  console.log(`Root: ${ROOT}`);

  console.log('\nFinding HTML files...');
  const htmlFiles = findHtmlFiles(ROOT);
  console.log(`Found ${htmlFiles.length} HTML files\n`);

  const report = {
    totalFiles: htmlFiles.length,
    modifiedFiles: [],
    skippedFiles: 0,
    changeSummary: {},
  };

  let processed = 0;
  for (const filePath of htmlFiles) {
    const changes = processFile(filePath);
    processed++;
    if (changes && changes.length > 0) {
      const relPath = path.relative(ROOT, filePath);
      report.modifiedFiles.push({ file: relPath, changes });
      for (const c of changes) {
        report.changeSummary[c] = (report.changeSummary[c] || 0) + 1;
      }
      if (processed % 50 === 0 || changes.length > 0) {
        process.stdout.write(`[${processed}/${htmlFiles.length}] Modified: ${path.relative(ROOT, filePath)}\n`);
      }
    } else {
      report.skippedFiles++;
    }
    if (processed % 100 === 0 && !changes) {
      process.stdout.write(`[${processed}/${htmlFiles.length}] Processed...\n`);
    }
  }

  console.log('\n=== SUMMARY ===\n');
  console.log(`Total HTML files:   ${report.totalFiles}`);
  console.log(`Modified files:     ${report.modifiedFiles.length}`);
  console.log(`Unchanged files:    ${report.skippedFiles}`);
  console.log('\nChange counts:');
  for (const [change, count] of Object.entries(report.changeSummary).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(4)}  ${change}`);
  }

  // Write report to file
  const reportPath = path.join(ROOT, 'cleanup_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nFull report written to: ${reportPath}`);
}

main();
