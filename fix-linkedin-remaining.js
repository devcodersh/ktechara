const fs = require('fs');

const files = [
  'ai-governance/index.html',
  'ccs-media-and-servium-become-advania/index.html',
  'ccs-media-and-servium-become-advania.1.html',
  'e-books/succeed-with-microsoft-azure/index.html',
  'insurance-at-the-digital-frontier/index.html@utm_source=website&utm_medium=CTA.html',
  'insurance-at-the-digital-frontier@utm_source=website&utm_medium=blog&utm_term=cta.html',
];

// Remove a <div ...> block where the opening tag contains the marker string.
// Handles nested divs by counting depth.
function removeDivByMarker(content, marker) {
  let idx = content.indexOf(marker);
  if (idx === -1) return content;

  // Walk backward to find the start of the <div that contains this marker
  const divStart = content.lastIndexOf('<div', idx);
  if (divStart === -1) return content;

  // Verify the marker is on the same opening tag (before the first '>')
  const tagEnd = content.indexOf('>', divStart);
  if (tagEnd === -1 || tagEnd < idx) return content;

  // Now find the matching closing </div> by counting depth
  let depth = 1;
  let pos = tagEnd + 1;
  while (depth > 0 && pos < content.length) {
    const nextOpen = content.indexOf('<div', pos);
    const nextClose = content.indexOf('</div>', pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) {
        const end = nextClose + 6; // length of '</div>'
        // Also consume trailing newline if present
        let trimEnd = end;
        if (content[trimEnd] === '\r') trimEnd++;
        if (content[trimEnd] === '\n') trimEnd++;
        content = content.slice(0, divStart) + content.slice(trimEnd);
        return content;
      }
      pos = nextClose + 6;
    }
  }
  return content;
}

const base = 'd:/Projects/New folder/ktechara/';
let changed = 0;

for (const rel of files) {
  const fp = base + rel;
  if (!fs.existsSync(fp)) { console.log('NOT FOUND:', rel); continue; }

  let content = fs.readFileSync(fp, 'utf8');
  const original = content;

  // Remove desktop LinkedIn div (aria-label="Follow Advania on Linkedin")
  content = removeDivByMarker(content, 'aria-label="Follow Advania on Linkedin"');
  // Remove mobile LinkedIn div (aria-label="Advania on Linkedin")
  content = removeDivByMarker(content, 'aria-label="Advania on Linkedin"');

  if (content !== original) {
    fs.writeFileSync(fp, content, 'utf8');
    console.log('Changed:', rel);
    changed++;
  } else {
    console.log('No change:', rel);
  }
}

console.log('Total changed:', changed);
