#!/usr/bin/env node
/**
 * Download Typekit (Adobe Fonts) CSS + all font files for local hosting.
 * Writes: wp-content/themes/hello-theme-child-master/fonts/typekit.css
 * and all woff2/woff/otf font files in that same directory.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const TYPEKIT_CSS_URL = 'https://use.typekit.net/wwb1uys.css';
const FONT_DIR = path.join(__dirname, 'wp-content', 'themes', 'hello-theme-child-master', 'fonts');
const LOCAL_CSS_PATH = path.join(FONT_DIR, 'typekit.css');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/css,*/*;q=0.1',
  'Referer': 'https://ktechara.co.uk/',
};

function fetch(fetchUrl, extraHeaders = {}, retries = 3) {
  return new Promise((resolve) => {
    const attempt = (n) => {
      const parsedUrl = new url.URL(fetchUrl);
      const lib = parsedUrl.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: { ...HEADERS, ...extraHeaders },
      };
      const req = lib.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetch(res.headers.location, extraHeaders, retries - 1).then(resolve);
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', (e) => {
        console.error(`  [attempt ${n}] Error: ${e.message}`);
        if (n < retries) setTimeout(() => attempt(n + 1), 2000);
        else resolve(null);
      });
      req.setTimeout(30000, () => { req.destroy(); });
      req.end();
    };
    attempt(1);
  });
}

function urlToLocalFilename(fontUrl) {
  // e.g. https://use.typekit.net/af/e0617b/000000000000000077359943/30/l?primer=...
  const m = fontUrl.match(/\/af\/([a-f0-9]+)\/([0-9a-f]+)\/(\d+)\/([lda])/);
  if (m) {
    const [, color, glyphId, ver, fmt] = m;
    const extMap = { l: 'woff2', d: 'woff', a: 'otf' };
    const ext = extMap[fmt] || 'bin';
    return `${color}_${glyphId}_${ver}_${fmt}.${ext}`;
  }
  // fallback
  const crypto = require('crypto');
  return crypto.createHash('md5').update(fontUrl).digest('hex') + '.font';
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(FONT_DIR, { recursive: true });

  console.log(`Fetching Typekit CSS: ${TYPEKIT_CSS_URL}`);
  const cssBuffer = await fetch(TYPEKIT_CSS_URL);
  if (!cssBuffer) {
    console.error('FAILED to fetch Typekit CSS. Aborting.');
    process.exit(1);
  }
  let css = cssBuffer.toString('utf8');

  // Remove @import of p.typekit.net (tracking, not needed)
  css = css.replace(/@import url\("https:\/\/p\.typekit\.net\/[^"]+"\);\n?/g, '');

  // Find all font URLs
  const fontUrlPattern = /url\("(https:\/\/use\.typekit\.net\/[^"]+)"\)/g;
  const fontUrls = [];
  let m;
  while ((m = fontUrlPattern.exec(css)) !== null) {
    if (!fontUrls.includes(m[1])) fontUrls.push(m[1]);
  }
  console.log(`Found ${fontUrls.length} unique font URLs\n`);

  const urlMap = {};
  let downloaded = 0;
  const failed = [];

  for (const fontUrl of fontUrls) {
    const localName = urlToLocalFilename(fontUrl);
    const localPath = path.join(FONT_DIR, localName);
    const ext = localName.split('.').pop();

    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 100) {
      console.log(`  [cached] ${localName}`);
      urlMap[fontUrl] = localName;
      downloaded++;
      continue;
    }

    console.log(`  Downloading ${ext}: ${localName}`);
    const data = await fetch(fontUrl);
    if (data && data.length > 100) {
      fs.writeFileSync(localPath, data);
      urlMap[fontUrl] = localName;
      downloaded++;
    } else {
      console.error(`  FAILED: ${fontUrl}`);
      failed.push(fontUrl);
      urlMap[fontUrl] = fontUrl; // keep original URL as fallback
    }
    await sleep(100);
  }

  console.log(`\nDownloaded: ${downloaded}/${fontUrls.length}`);
  if (failed.length) {
    console.log(`Failed (${failed.length}):`);
    failed.forEach(f => console.log(`  ${f}`));
  }

  // Build local CSS: replace all font URLs with local filenames
  let localCss = css;
  for (const [origUrl, localName] of Object.entries(urlMap)) {
    // Escape special regex chars in URL
    const escaped = origUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    localCss = localCss.replace(new RegExp(escaped, 'g'), localName);
  }

  // Clean up the license comment block
  localCss = localCss.replace(
    /\/\*\s*\* The Typekit service[\s\S]*?© 2009-\d+ Adobe Systems Incorporated\. All Rights Reserved\.\s*\*\//,
    '/* Adobe Typekit fonts - locally hosted */'
  );
  // Remove JSON timestamp comment
  localCss = localCss.replace(/\/\*\{"last_published":[^}]*\}\*\/\n?/g, '');

  fs.writeFileSync(LOCAL_CSS_PATH, localCss, 'utf8');
  console.log(`\nLocal Typekit CSS written to: ${LOCAL_CSS_PATH}`);
  console.log('Font download complete.');
}

main().catch(e => { console.error(e); process.exit(1); });
