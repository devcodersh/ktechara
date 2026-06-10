/**
 * Shared header/footer include loader.
 * Fetches _header.html and _footer.html and injects them into every page.
 * Resolves paths relative to site root automatically.
 */
(function () {
  // Determine root path depth so relative links work from any sub-folder
  var path = window.location.pathname;
  // Count how many levels deep we are (remove leading slash and filename)
  var parts = path.replace(/^\//, '').split('/');
  // If last part looks like a file (has extension) remove it
  if (parts[parts.length - 1].indexOf('.') !== -1) parts.pop();
  var depth = parts.filter(function(p){ return p !== ''; }).length;
  var root = '';
  for (var i = 0; i < depth; i++) root += '../';

  function fixLinks(el) {
    // Rewrite all href/src that start with a relative path to use root prefix
    var links = el.querySelectorAll('a[href], img[src], link[href], script[src]');
    links.forEach(function(node) {
      var attr = node.hasAttribute('href') ? 'href' : 'src';
      var val = node.getAttribute(attr);
      if (val &&
          !val.startsWith('http') &&
          !val.startsWith('//') &&
          !val.startsWith('#') &&
          !val.startsWith('mailto') &&
          !val.startsWith('tel') &&
          !val.startsWith('/') &&
          root !== '') {
        node.setAttribute(attr, root + val);
      }
    });
  }

  function inject(selector, file, position) {
    var placeholder = document.querySelector(selector);
    if (!placeholder) return;
    fetch(root + file)
      .then(function(r){ return r.text(); })
      .then(function(html) {
        var wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        fixLinks(wrapper);
        if (position === 'replace') {
          placeholder.parentNode.insertBefore(wrapper.firstChild, placeholder);
          placeholder.parentNode.removeChild(placeholder);
        } else {
          placeholder.innerHTML = wrapper.innerHTML;
        }
      })
      .catch(function(e){ console.warn('Include failed:', file, e); });
  }

  document.addEventListener('DOMContentLoaded', function() {
    inject('#site-header-placeholder', '_header.html', 'replace');
    inject('#site-footer-placeholder', '_footer.html', 'replace');
  });
})();
