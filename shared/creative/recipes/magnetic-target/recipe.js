/* Magnetic target: one delegated, passive pointer listener for every .magnetic control.
 * ExperienceMagnetic.init({ scope, strength = 0.3, max = 12 }) returns a destroy function.
 * Classic script: defines globalThis.ExperienceMagnetic. */
(function (global) {
  'use strict';

  function init(opts) {
    opts = opts || {};
    var doc = global.document;
    var root = doc.documentElement;
    var scope = opts.scope || doc;
    var strength = opts.strength === undefined ? 0.3 : opts.strength;
    var max = opts.max === undefined ? 12 : opts.max;
    var reduced = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var active = null;
    var x = 0, y = 0, raf = 0;

    function off() {
      var tier = root.getAttribute('data-quality');
      return tier === 'static' || tier === 'low' || (reduced && reduced.matches);
    }
    function clamp(v) { return Math.max(-max, Math.min(max, v)); }
    function write() {
      raf = 0;
      if (!active) return;
      var r = active.getBoundingClientRect();
      active.style.setProperty('--mx', clamp((x - (r.left + r.width / 2)) * strength).toFixed(1) + 'px');
      active.style.setProperty('--my', clamp((y - (r.top + r.height / 2)) * strength).toFixed(1) + 'px');
      active.classList.add('is-pulled');
    }
    function release() {
      if (!active) return;
      active.classList.remove('is-pulled'); // the CSS spring carries it home
      active.style.removeProperty('--mx');
      active.style.removeProperty('--my');
      active = null;
    }
    function onMove(e) {
      if (e.pointerType !== 'mouse' || off()) { release(); return; }
      var el = e.target && e.target.closest ? e.target.closest('.magnetic') : null;
      if (el && (el.disabled || el.getAttribute('aria-disabled') === 'true')) el = null;
      if (el !== active) { release(); active = el; }
      if (!active) return;
      x = e.clientX; y = e.clientY;
      if (!raf) raf = global.requestAnimationFrame(write);
    }

    scope.addEventListener('pointermove', onMove, { passive: true });
    doc.addEventListener('pointerleave', release);
    return function destroy() {
      scope.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerleave', release);
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      release();
    };
  }

  global.ExperienceMagnetic = { init: init };
})(typeof globalThis !== 'undefined' ? globalThis : window);
