/* Scroll progress and reveal: fallback for browsers without scroll-driven animations.
 * Does nothing where CSS already handles it, unless { force: true } is passed (for testing).
 * Classic script: defines globalThis.ExperienceScroll. */
(function (global) {
  'use strict';

  function init(opts) {
    opts = opts || {};
    var doc = global.document;
    var root = doc.documentElement;
    var native = global.CSS && global.CSS.supports && global.CSS.supports('animation-timeline: view()');
    if (native && !opts.force) return function () {};

    var bar = doc.querySelector('.scroll-progress');
    var raf = 0;
    function write() {
      raf = 0;
      var max = root.scrollHeight - global.innerHeight;
      bar.style.setProperty('--scroll-progress', max > 0 ? Math.min(1, Math.max(0, global.scrollY / max)).toFixed(4) : '0');
    }
    function onScroll() { if (!raf) raf = global.requestAnimationFrame(write); } // one write per frame, only while scrolling
    if (bar) {
      if (opts.force) bar.style.animation = 'none';
      global.addEventListener('scroll', onScroll, { passive: true });
      global.addEventListener('resize', onScroll, { passive: true });
      write();
    }

    var io = null;
    if (global.IntersectionObserver) {
      io = new global.IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          io.unobserve(e.target); // reveal once; nothing left to watch afterwards
        });
      }, { rootMargin: '0px 0px -10% 0px' });
      // Hide only now that the observer exists to bring each element back.
      root.classList.add('reveal-js');
      Array.prototype.forEach.call(doc.querySelectorAll('.reveal'), function (el) { io.observe(el); });
    }

    return function destroy() {
      if (raf) global.cancelAnimationFrame(raf);
      global.removeEventListener('scroll', onScroll);
      global.removeEventListener('resize', onScroll);
      if (io) io.disconnect();
      root.classList.remove('reveal-js');
    };
  }

  global.ExperienceScroll = { init: init };
})(typeof globalThis !== 'undefined' ? globalThis : window);
