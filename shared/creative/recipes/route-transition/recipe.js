/* Same-document route and shared-element transitions.
 * ExperienceRoute.transition(update, { shared: [{ from, to, name }] }) runs `update` (which
 * changes the DOM, and may return a promise) inside a view transition. `from` and `to` are
 * elements, selectors, or functions returning an element; `to` is resolved after the update.
 * Resolves to { animated }. The update always runs, exactly once, even when nothing animates.
 * Classic script: defines globalThis.ExperienceRoute. */
(function (global) {
  'use strict';

  function find(ref) {
    if (!ref) return null;
    if (typeof ref === 'function') return ref();
    if (typeof ref === 'string') return global.document.querySelector(ref);
    return ref;
  }

  function transition(update, opts) {
    opts = opts || {};
    var doc = global.document;
    var root = doc.documentElement;
    var tier = root.getAttribute('data-quality');
    var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!doc.startViewTransition || tier === 'static' || reduced) {
      return Promise.resolve().then(update).then(function () { return { animated: false }; });
    }

    // Names exist only while the transition runs, so lists never hold duplicate names and
    // no element is promoted to its own layer at rest. The low tier cross-fades only.
    var shared = tier === 'low' ? [] : (opts.shared || []);
    var named = [];
    function name(el, value) { if (el) { el.style.viewTransitionName = value; named.push(el); } }
    function clear() { named.forEach(function (el) { el.style.viewTransitionName = ''; }); named = []; }

    shared.forEach(function (s) { name(find(s.from), s.name); });
    var vt = doc.startViewTransition(function () {
      clear();
      return Promise.resolve().then(update).then(function () {
        shared.forEach(function (s) { name(find(s.to), s.name); });
      });
    });
    function done(animated) { return function () { clear(); return { animated: animated }; }; }
    // A skipped transition (hidden tab, a newer one started) still applied the update.
    return vt.finished.then(done(true), done(false));
  }

  global.ExperienceRoute = { transition: transition };
})(typeof globalThis !== 'undefined' ? globalThis : window);
