/* Cursor light: one delegated, passive pointer listener for every .cursor-light surface.
 * Writes at most once per frame, only while the pointer moves; no loop runs at rest.
 * ExperienceCursorLight.init(root?) returns a destroy function.
 * Classic script: defines globalThis.ExperienceCursorLight. */
(function (global) {
  'use strict';

  function init(scope) {
    var doc = global.document;
    var root = doc.documentElement;
    scope = scope || doc;
    var reduced = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var active = null; // the surface currently lit
    var x = 0, y = 0, raf = 0;

    function write() {
      raf = 0;
      if (!active) return;
      var r = active.getBoundingClientRect();
      active.style.setProperty('--lx', (x - r.left).toFixed(1) + 'px');
      active.style.setProperty('--ly', (y - r.top).toFixed(1) + 'px');
    }
    function release() {
      if (!active) return;
      active.style.removeProperty('--lx');
      active.style.removeProperty('--ly');
      active = null;
    }
    function onMove(e) {
      // Touch has no resting pointer to follow; static tier and reduced motion do not track.
      if (e.pointerType === 'touch' || root.getAttribute('data-quality') === 'static' || (reduced && reduced.matches)) { release(); return; }
      var el = e.target && e.target.closest ? e.target.closest('.cursor-light') : null;
      if (el !== active) { release(); active = el; }
      if (!active) return;
      x = e.clientX; y = e.clientY;
      if (!raf) raf = global.requestAnimationFrame(write);
    }
    function onLeave() { release(); }

    scope.addEventListener('pointermove', onMove, { passive: true });
    doc.addEventListener('pointerleave', onLeave);
    return function destroy() {
      scope.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerleave', onLeave);
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      release();
    };
  }

  global.ExperienceCursorLight = { init: init };
})(typeof globalThis !== 'undefined' ? globalThis : window);
