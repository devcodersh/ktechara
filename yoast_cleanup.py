#!/usr/bin/env python3
import argparse
import re
from pathlib import Path

OPEN_COMMENT_RE = re.compile(r'<!--\s*This site is optimized with the Yoast SEO plugin[\s\S]*?-->\s*', re.IGNORECASE)
CLOSE_COMMENT_RE = re.compile(r'<!--\s*/\s*Yoast SEO plugin\.\s*-->\s*', re.IGNORECASE)
YOAST_SCRIPT_RE = re.compile(r'<script[^>]*class=["\']yoast-schema-graph["\'][\s\S]*?</script>\s*', re.IGNORECASE)
TWITTER_LABEL_RE = re.compile(r'<meta\s+name=["\']twitter:label1["\'].*?>\s*', re.IGNORECASE)
TWITTER_DATA_RE = re.compile(r'<meta\s+name=["\']twitter:data1["\'].*?>\s*', re.IGNORECASE)

# Keep title and meta description unchanged; we will not touch them.

HTML_GLOB = '**/*.html'


def clean_content(text: str) -> (str, bool):
    orig = text
    # Remove opening Yoast comment(s)
    text = OPEN_COMMENT_RE.sub('', text)
    # Remove Yoast JSON-LD script block(s)
    text = YOAST_SCRIPT_RE.sub('', text)
    # Remove closing Yoast comment(s)
    text = CLOSE_COMMENT_RE.sub('', text)
    # Remove twitter label/data meta tags
    text = TWITTER_LABEL_RE.sub('', text)
    text = TWITTER_DATA_RE.sub('', text)
    # Collapse repeated blank lines from removals
    text = re.sub(r"\n{3,}", "\n\n", text)
    changed = (text != orig)
    return text, changed


def process_files(root: Path, dry_run: bool=False):
    files = list(root.glob(HTML_GLOB))
    candidates = []
    for p in files:
        try:
            content = p.read_text(encoding='utf-8')
        except Exception:
            try:
                content = p.read_text(encoding='latin-1')
            except Exception:
                print('Skipping unreadable file', p)
                continue
        if 'Yoast SEO plugin' in content or 'yoast-schema-graph' in content:
            new_content, changed = clean_content(content)
            if changed:
                candidates.append((p, content, new_content))
    if dry_run:
        for p, _old, _new in candidates:
            print('Would change:', p)
        print('\nDry-run: would change', len(candidates), 'files')
        return len(candidates)
    # Apply
    changed_count = 0
    for p, old, new in candidates:
        # Safety: preserve original encoding by writing utf-8
        p.write_text(new, encoding='utf-8')
        changed_count += 1
    print('Changed', changed_count, 'files')
    return changed_count


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Cleanup Yoast SEO metadata blocks while preserving title and description')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    root = Path('.')
    count = process_files(root, dry_run=args.dry_run)
    
