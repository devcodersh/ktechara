import argparse
import re
from pathlib import Path

RSS_PATTERNS = [
    re.compile(r"<link[^>]+rel=[\"']?alternate[\"']?[^>]*type=[\"']?application/(?:rss|atom)\+xml[\"']?[^>]*/?>", re.IGNORECASE),
    re.compile(r"<atom:link[^>]*type=[\"']?application/rss\+xml[\"']?[^>]*/?>", re.IGNORECASE),
    re.compile(r"<link[^>]+rel=[\"']?alternate[\"']?[^>]*href=[\"'][^\"']*feed[^\"']*[\"'][^>]*/?>", re.IGNORECASE),
    re.compile(r"<link[^>]+type=[\"']?application/rss\+xml[\"']?[^>]*/?>", re.IGNORECASE),
]


def should_skip(path: Path) -> bool:
    parts = [p.lower() for p in path.parts]
    return "feed" in parts


def clean_text(text: str) -> str:
    new = text
    for pat in RSS_PATTERNS:
        new = pat.sub("", new)
    # collapse multiple blank lines
    new = re.sub(r"\n[ \t\r]*\n+", "\n\n", new)
    return new


def find_files(root: Path):
    return [p for p in root.rglob("*.html") if not should_skip(p)]


def main():
    parser = argparse.ArgumentParser(description="Remove RSS/Atom link tags from static HTML pages")
    parser.add_argument("--root", default='.', help="Project root to scan")
    parser.add_argument("--dry-run", action="store_true", help="Don't write files, just list candidates")
    parser.add_argument("--show-sample", action="store_true", help="Show sample before/after for first changed file")
    args = parser.parse_args()

    root = Path(args.root)
    files = find_files(root)
    changed = []
    failed_writes = []
    sample_before = sample_after = None

    for p in files:
        try:
            txt = p.read_text(encoding='utf-8')
        except Exception:
            try:
                txt = p.read_text(encoding='latin-1')
            except Exception:
                continue
        new = clean_text(txt)
        if new != txt:
            changed.append(str(p))
            if sample_before is None and args.show_sample:
                sample_before = txt[:1000]
                sample_after = new[:1000]
            if not args.dry_run:
                try:
                    p.write_text(new, encoding='utf-8')
                except Exception:
                    try:
                        with p.open('wb') as f:
                            f.write(new.encode('utf-8', errors='replace'))
                    except Exception as e:
                        failed_writes.append(f"{p}: {e}")

    print(f"Found {len(changed)} files that would be changed.")
    if changed:
        for f in changed[:200]:
            print(f)
    if failed_writes:
        print("\nFailed to write the following files:")
        for f in failed_writes:
            print(f)
    if args.show_sample and sample_before is not None:
        print("\n--- sample before ---")
        print(sample_before)
        print("\n--- sample after ---")
        print(sample_after)


if __name__ == '__main__':
    main()
