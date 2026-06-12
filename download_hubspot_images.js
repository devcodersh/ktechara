#!/usr/bin/env node
/**
 * Download HubSpot images from info.advania.co.uk/hs-fs/hubfs/ and update all HTML references.
 * Images are saved to: wp-content/uploads/hubspot/
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const HUBSPOT_IMG_DIR = path.join(ROOT, 'wp-content', 'uploads', 'hubspot');
const LOCAL_PATH_FROM_ROOT = 'wp-content/uploads/hubspot';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
  'Referer': 'https://info.advania.co.uk/',
};

function fetch(fetchUrl, retries = 3) {
  return new Promise((resolve) => {
    const attempt = (n) => {
      const parsedUrl = new url.URL(fetchUrl);
      const lib = parsedUrl.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: HEADERS,
      };
      const req = lib.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetch(res.headers.location, retries - 1).then(resolve);
        }
        if (res.statusCode !== 200) {
          console.error(`  HTTP ${res.statusCode} for ${fetchUrl}`);
          resolve(null);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', (e) => {
        if (n < retries) {
          console.error(`  [attempt ${n}] Error: ${e.message}, retrying...`);
          setTimeout(() => attempt(n + 1), 2000);
        } else {
          resolve(null);
        }
      });
      req.setTimeout(30000, () => { req.destroy(); });
      req.end();
    };
    attempt(1);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function urlToLocalFilename(imgUrl) {
  // Extract path after /hs-fs/hubfs/ and flatten to safe filename
  const m = imgUrl.match(/\/hs-fs\/hubfs\/(.+)$/);
  if (!m) return null;
  let name = decodeURIComponent(m[1]);
  // Take just the filename (after last slash)
  name = name.replace(/\//g, '__');
  // Remove query params
  name = name.split('?')[0];
  // Sanitize: replace spaces with underscores, remove unsafe chars
  name = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._\-]/g, '');
  return name;
}

function findHtmlFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git') continue;
      results.push(...findHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

function getDepth(filePath) {
  const rel = path.relative(ROOT, filePath);
  return rel.split(path.sep).length - 1;
}

function getLocalImgPath(filePath, localName) {
  const depth = getDepth(filePath);
  const prefix = depth === 0 ? '' : '../'.repeat(depth);
  return prefix + LOCAL_PATH_FROM_ROOT + '/' + localName;
}

async function main() {
  fs.mkdirSync(HUBSPOT_IMG_DIR, { recursive: true });

  // Find all unique hs-fs/hubfs image base URLs
  console.log('Scanning HTML files for HubSpot image URLs...');
  const htmlFiles = findHtmlFiles(ROOT);

  const imgUrlSet = new Set();
  // Pattern: src="https://info.advania.co.uk/hs-fs/hubfs/...?width=..."
  const imgPattern = /src="(https:\/\/info\.advania\.co\.uk\/hs-fs\/hubfs\/[^?"]+)(?:\?[^"]*)?"/ ;

  for (const filePath of htmlFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const pattern = /src="(https:\/\/info\.advania\.co\.uk\/hs-fs\/hubfs\/[^?"]+)(?:[^"]*)?"/ ;
    const globalPattern = new RegExp(pattern.source, 'g');
    let m;
    while ((m = globalPattern.exec(content)) !== null) {
      imgUrlSet.add(m[1]);
    }
  }

  const uniqueUrls = [...imgUrlSet];
  console.log(`Found ${uniqueUrls.length} unique HubSpot image base URLs\n`);

  // Download each image
  const urlToLocal = {};
  let downloaded = 0;
  const failed = [];

  for (const imgUrl of uniqueUrls) {
    const localName = urlToLocalFilename(imgUrl);
    if (!localName) {
      console.error(`  Cannot derive filename for: ${imgUrl}`);
      continue;
    }
    const localPath = path.join(HUBSPOT_IMG_DIR, localName);

    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 100) {
      console.log(`  [cached] ${localName}`);
      urlToLocal[imgUrl] = localName;
      downloaded++;
      continue;
    }

    // Try downloading at a reasonable resolution (width=800 param)
    const downloadUrl = imgUrl + '?width=800';
    console.log(`  Downloading: ${localName}`);
    const data = await fetch(downloadUrl);
    if (data && data.length > 100) {
      fs.writeFileSync(localPath, data);
      urlToLocal[imgUrl] = localName;
      downloaded++;
    } else {
      // Try without query param
      const data2 = await fetch(imgUrl);
      if (data2 && data2.length > 100) {
        fs.writeFileSync(localPath, data2);
        urlToLocal[imgUrl] = localName;
        downloaded++;
      } else {
        console.error(`  FAILED: ${imgUrl}`);
        failed.push(imgUrl);
      }
    }
    await sleep(150);
  }

  console.log(`\nDownloaded: ${downloaded}/${uniqueUrls.length}`);
  if (failed.length) {
    console.log(`Failed (${failed.length}):`);
    failed.forEach(f => console.log(`  ${f}`));
  }

  // Now update all HTML files to use local paths
  console.log('\nUpdating HTML files with local image paths...');
  let filesModified = 0;

  for (const filePath of htmlFiles) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    for (const [origUrl, localName] of Object.entries(urlToLocal)) {
      if (!content.includes(origUrl)) continue;

      const localRelPath = getLocalImgPath(filePath, localName);

      // Replace src="...origUrl...?query..." with local path
      // The URL may appear with various query params after it
      const escapedUrl = origUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match the URL followed by optional query string until closing quote
      const replacePattern = new RegExp(escapedUrl + '(?:\\?[^"]*)?', 'g');
      content = content.replace(replacePattern, localRelPath);
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      filesModified++;
    }
  }

  console.log(`Updated ${filesModified} HTML files`);

  // Final check
  const remaining = [];
  for (const filePath of htmlFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('info.advania.co.uk/hs-fs/hubfs/')) {
      remaining.push(path.relative(ROOT, filePath));
    }
  }
  if (remaining.length === 0) {
    console.log('\nAll HubSpot hs-fs/hubfs image references replaced successfully.');
  } else {
    console.log(`\nRemaining files with hs-fs/hubfs (${remaining.length}):`);
    remaining.forEach(f => console.log(`  ${f}`));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
