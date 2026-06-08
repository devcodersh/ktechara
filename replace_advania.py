import os
import re
import sys
from html import escape
from html.parser import HTMLParser

BRAND_MAP = {'Advania': 'KTechara', 'ADVANIA': 'KTECHARA', 'advania': 'ktechara'}
PATTERN = re.compile(r'Advania|ADVANIA|advania')
URL_LIKE_CHARS = set(':/.@\\')

META_PROPERTY_REPLACEMENTS = {
    'og:description',
    'og:site_name',
    'og:title',
}

META_NAME_REPLACEMENTS = {
    'description',
}


def token_looks_like_url(token: str) -> bool:
    return any(ch in token for ch in URL_LIKE_CHARS) or '.' in token


def replace_brand_text(text: str) -> str:
    if not text:
        return text

    def repl(match: re.Match) -> str:
        start, end = match.span()
        left = start
        while left > 0 and not text[left - 1].isspace():
            left -= 1
        right = end
        while right < len(text) and not text[right].isspace():
            right += 1
        token = text[left:right]
        if token_looks_like_url(token):
            return match.group(0)
        return BRAND_MAP.get(match.group(0), match.group(0))

    return PATTERN.sub(repl, text)


class BrandHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.output = []
        self.tag_stack = []
        self.current_meta_replacement = False

    def handle_starttag(self, tag, attrs):
        self.tag_stack.append(tag)
        self.current_meta_replacement = False
        attr_parts = []
        if tag == 'meta':
            meta_name = None
            meta_property = None
            for name, value in attrs:
                if name == 'name' and value is not None:
                    meta_name = value.lower()
                if name == 'property' and value is not None:
                    meta_property = value.lower()
            if meta_name in META_NAME_REPLACEMENTS or meta_property in META_PROPERTY_REPLACEMENTS:
                self.current_meta_replacement = True

        for name, value in attrs:
            if value is None:
                attr_parts.append(name)
                continue
            if name in ('alt', 'title'):
                value = replace_brand_text(value)
            elif tag == 'meta' and name == 'content' and self.current_meta_replacement:
                value = replace_brand_text(value)
            attr_parts.append(f'{name}="{escape(value, quote=True)}"')

        attrs_text = '' if not attr_parts else ' ' + ' '.join(attr_parts)
        self.output.append(f'<{tag}{attrs_text}>')

    def handle_startendtag(self, tag, attrs):
        self.current_meta_replacement = False
        attr_parts = []
        if tag == 'meta':
            meta_name = None
            meta_property = None
            for name, value in attrs:
                if name == 'name' and value is not None:
                    meta_name = value.lower()
                if name == 'property' and value is not None:
                    meta_property = value.lower()
            if meta_name in META_NAME_REPLACEMENTS or meta_property in META_PROPERTY_REPLACEMENTS:
                self.current_meta_replacement = True

        for name, value in attrs:
            if value is None:
                attr_parts.append(name)
                continue
            if name in ('alt', 'title'):
                value = replace_brand_text(value)
            elif tag == 'meta' and name == 'content' and self.current_meta_replacement:
                value = replace_brand_text(value)
            attr_parts.append(f'{name}="{escape(value, quote=True)}"')

        attrs_text = '' if not attr_parts else ' ' + ' '.join(attr_parts)
        self.output.append(f'<{tag}{attrs_text} />')

    def handle_endtag(self, tag):
        if self.tag_stack and self.tag_stack[-1] == tag:
            self.tag_stack.pop()
        self.output.append(f'</{tag}>')

    def handle_data(self, data):
        if self.tag_stack and self.tag_stack[-1] in ('script', 'style'):  # preserve script/style content
            self.output.append(data)
        else:
            self.output.append(replace_brand_text(data))

    def handle_comment(self, data):
        self.output.append(f'<!--{data}-->')

    def handle_decl(self, decl):
        self.output.append(f'<!{decl}>')

    def handle_entityref(self, name):
        self.output.append(f'&{name};')

    def handle_charref(self, name):
        self.output.append(f'&#{name};')


def process_html_file(path: str, dry_run: bool = False) -> int:
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    parser = BrandHTMLParser()
    parser.feed(content)
    parser.close()
    updated = ''.join(parser.output)
    if updated != content:
        if not dry_run:
            with open(path, 'w', encoding='utf-8', errors='replace') as f:
                f.write(updated)
        return 1
    return 0


def main():
    root = os.getcwd()
    dry_run = '--dry-run' in sys.argv
    files = []
    for dirpath, _, filenames in os.walk(root):
        for filename in filenames:
            if filename.lower().endswith('.html'):
                files.append(os.path.join(dirpath, filename))

    if dry_run:
        print(f'Found {len(files)} HTML files to inspect.')

    changed = 0
    for path in files:
        if process_html_file(path, dry_run=dry_run):
            changed += 1
            print('would change:', path)

    if dry_run:
        print(f'Would change {changed} files.')
    else:
        print(f'Changed {changed} files.')


if __name__ == '__main__':
    main()
