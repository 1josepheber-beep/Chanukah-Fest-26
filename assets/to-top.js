/* Back to top.

   A button that stays out of the way until there is something to go back
   up from. Built here rather than written into all five pages, so there is
   one copy of it; the styling lives in nav.css alongside the header. */
(function () {
  "use strict";

  var SHOW_AFTER = 420;            /* roughly one screen on a phone */

  function ready() {
    if (document.querySelector(".cftop")) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cftop";
    btn.setAttribute("aria-label", "Back to top");
    document.body.appendChild(btn);

    var on = false;
    function check() {
      var past = (window.pageYOffset || document.documentElement.scrollTop) > SHOW_AFTER;
      if (past === on) return;     /* only touch the class when it changes */
      on = past;
      btn.classList.toggle("cftop-on", past);
    }

    btn.addEventListener("click", function () {
      var smooth = !window.matchMedia ||
                   !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      try {
        window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
      } catch (e) {
        window.scrollTo(0, 0);     /* older Safari takes no options object */
      }
    });

    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    check();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
