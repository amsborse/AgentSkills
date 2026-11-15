/* Demo pages only: a tier picker and a readout wired to the shared quality runtime.
 * Expects <select data-quality-pick> and <output data-quality-out> in the page. */
(function () {
  'use strict';
  var q = ExperienceQuality.shared();
  var pick = document.querySelector('[data-quality-pick]');
  var out = document.querySelector('[data-quality-out]');
  function show() {
    if (out) out.textContent = q.tier + (q.reasons.length ? ' · ' + q.reasons.join(', ') : ' · measured');
    if (pick) pick.value = q.mode === 'forced' ? q.tier : 'auto';
  }
  if (pick) {
    ['auto'].concat(ExperienceQuality.TIERS).forEach(function (t) {
      var o = document.createElement('option');
      o.value = t;
      o.textContent = t === 'auto' ? 'Automatic' : t.charAt(0).toUpperCase() + t.slice(1);
      pick.appendChild(o);
    });
    // A demo choice lasts for the page view only, so one demo does not pin the next.
    pick.addEventListener('change', function () { q.set(pick.value, { persist: false }); });
  }
  q.on(show);
  show();
})();
