(function () {
  // The school browser has no native bridge. This only changes page layout.
  var visited = [];
  function apply(doc) {
    if (!doc || visited.indexOf(doc) !== -1) return;
    visited.push(doc);
    var head = doc.head || doc.documentElement;
    var meta = doc.querySelector('meta[name="viewport" i]');
    if (!meta) {
      meta = doc.createElement('meta');
      meta.name = 'viewport';
      head.appendChild(meta);
    }
    meta.content = 'width=1280';
    Array.from(doc.querySelectorAll('iframe,frame')).forEach(function(frame) {
      try { apply(frame.contentDocument); } catch (_) { /* Cross-origin frames remain isolated. */ }
    });
  }
  apply(document);
  return 'desktop-viewport-applied';
})();
