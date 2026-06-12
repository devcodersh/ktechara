#!/usr/bin/env python3
"""
Download Typekit (Adobe Fonts) CSS and font files for local hosting.
Produces wp-content/themes/hello-theme-child-master/fonts/typekit.css
and downloads all woff2/woff/otf font files alongside it.
"""

import urllib.request
import urllib.error
import re
import os
import sys
import time

TYPEKIT_CSS_URL = "https://use.typekit.net/wwb1uys.css"
FONT_DIR = r"wp-content\themes\hello-theme-child-master\fonts"
LOCAL_CSS_PATH = os.path.join(FONT_DIR, "typekit.css")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/css,*/*;q=0.1",
    "Referer": "https://ktechara.co.uk/",
}


def fetch(url, headers=None, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers or HEADERS)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception as e:
            print(f"  [attempt {attempt+1}] Error fetching {url}: {e}")
            if attempt < retries - 1:
                time.sleep(2)
    return None


def url_to_local_filename(url):
    """Convert a typekit font URL to a safe local filename."""
    # e.g. https://use.typekit.net/af/e0617b/000000000000000077359943/30/l?...
    # Extract the hash path and format indicator
    m = re.search(r"/af/([a-f0-9]+)/([0-9a-f]+)/(\d+)/([lda])", url)
    if m:
        color, glyph_id, ver, fmt = m.groups()
        fmt_map = {"l": "woff2", "d": "woff", "a": "otf"}
        ext = fmt_map.get(fmt, "bin")
        return f"{color}_{glyph_id}_{ver}_{fmt}.{ext}"
    # fallback: hash the url
    import hashlib
    return hashlib.md5(url.encode()).hexdigest() + ".font"


def main():
    os.makedirs(FONT_DIR, exist_ok=True)

    print(f"Fetching Typekit CSS from: {TYPEKIT_CSS_URL}")
    css_bytes = fetch(TYPEKIT_CSS_URL)
    if not css_bytes:
        print("FAILED to fetch Typekit CSS. Aborting.")
        sys.exit(1)
    css = css_bytes.decode("utf-8")

    # Also fetch the p.typekit.net CSS that is @imported
    p_css_match = re.search(r'@import url\("(https://p\.typekit\.net/[^"]+)"\)', css)
    p_css_content = ""
    if p_css_match:
        p_url = p_css_match.group(1)
        print(f"Fetching p.typekit.net CSS: {p_url}")
        p_bytes = fetch(p_url)
        if p_bytes:
            p_css_content = p_bytes.decode("utf-8")
            print("  Got p.typekit.net CSS")
        else:
            print("  WARNING: Could not fetch p.typekit.net CSS")

    # Find all font URLs in the main CSS
    font_url_pattern = re.compile(r'url\("(https://use\.typekit\.net/[^"]+)"\)')
    font_urls = font_url_pattern.findall(css)
    print(f"\nFound {len(font_urls)} font URLs to download")

    # Download each font and build a mapping of old URL -> local path
    url_map = {}
    downloaded = 0
    failed = []

    for url in font_urls:
        local_name = url_to_local_filename(url)
        local_path = os.path.join(FONT_DIR, local_name)

        # Determine format for logging
        if "/l?" in url:
            fmt = "woff2"
        elif "/d?" in url:
            fmt = "woff"
        else:
            fmt = "otf"

        if os.path.exists(local_path) and os.path.getsize(local_path) > 100:
            print(f"  [cached] {local_name}")
            url_map[url] = local_name
            downloaded += 1
            continue

        print(f"  Downloading {fmt}: {local_name}")
        data = fetch(url)
        if data and len(data) > 100:
            with open(local_path, "wb") as f:
                f.write(data)
            url_map[url] = local_name
            downloaded += 1
        else:
            print(f"  FAILED: {url}")
            failed.append(url)
            # Keep original URL as fallback
            url_map[url] = url

        time.sleep(0.1)  # polite rate limiting

    print(f"\nDownloaded: {downloaded}/{len(font_urls)}")
    if failed:
        print(f"Failed ({len(failed)}):")
        for f in failed:
            print(f"  {f}")

    # Build the local CSS:
    # 1. Remove the @import of p.typekit.net (replace with inline content if available)
    # 2. Replace all font URLs with local relative paths
    local_css = css

    # Remove the @import line (we won't include the p.typekit.net content - it's tracking)
    local_css = re.sub(r'\n?@import url\("[^"]*p\.typekit\.net[^"]*"\);\n?', '\n', local_css)

    # Replace all font URLs with local filenames
    def replace_url(m):
        orig_url = m.group(1)
        local_name = url_map.get(orig_url, orig_url)
        if local_name == orig_url:
            return m.group(0)  # keep original if download failed
        return f'url("{local_name}")'

    local_css = font_url_pattern.sub(replace_url, local_css)

    # Strip the license comment block (keep a short attribution)
    local_css = re.sub(
        r'/\*\s*\* The Typekit service.*?© 2009-\d+ Adobe Systems Incorporated\. All Rights Reserved\.\s*\*/',
        '/* Adobe Typekit fonts - locally hosted */',
        local_css,
        flags=re.DOTALL
    )

    # Remove the JSON timestamp comment
    local_css = re.sub(r'/\*\{"last_published":[^}]*\}\*/', '', local_css)

    with open(LOCAL_CSS_PATH, "w", encoding="utf-8") as f:
        f.write(local_css)

    print(f"\nLocal Typekit CSS written to: {LOCAL_CSS_PATH}")
    print("Font download complete.")

    # Report what we need to tell the HTML fixer
    print(f"\n[SUMMARY]")
    print(f"Replace: <link rel=\"stylesheet\" type=\"text/css\" href=\"https://use.typekit.net/wwb1uys.css\">")
    print(f"With:    local path relative to each HTML file pointing to {LOCAL_CSS_PATH.replace(chr(92), '/')}")


if __name__ == "__main__":
    main()
