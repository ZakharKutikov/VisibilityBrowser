'use strict';

(function () {
  function closeOverlayAnimated(el, afterMs = 280) {
    if (!el) return Promise.resolve();
    return new Promise((resolve) => {
      if (!el.classList.contains('show')) {
        resolve();
        return;
      }
      el.classList.add('closing');
      el.classList.remove('show');
      setTimeout(() => {
        el.classList.remove('closing');
        resolve();
      }, afterMs);
    });
  }

  window.closeOverlayAnimated = closeOverlayAnimated;
})();
