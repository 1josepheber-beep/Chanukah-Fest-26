/* Small pieces of page behaviour: the back-to-top button, and tidying up
   after the menu on a phone.

   The menu itself is a native <details> and needs none of this to open and
   shut. What is here only makes it behave better: closing itself once you
   have chosen somewhere to go, and on Escape.

   Back to top.

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

  /* Tapping a link in the open menu jumps down the page, and the menu
     would otherwise still be sitting over what you came to read. */
  function menu() {
    var nav = document.querySelector(".cfnav");
    var btn = nav && nav.querySelector(".cfnav-toggle");
    if (!nav || !btn) return;

    function set(open) {
      nav.classList.toggle("cfnav-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    btn.addEventListener("click", function () {
      set(!nav.classList.contains("cfnav-open"));
    });

    /* Choosing somewhere to go jumps down the page, and the menu would
       otherwise still be sitting over what you came to read. */
    nav.addEventListener("click", function (ev) {
      var a = ev.target.closest && ev.target.closest(".cfnav-link");
      if (a) set(false);
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && nav.classList.contains("cfnav-open")) {
        set(false);
        btn.focus();
      }
    });

    /* Widen the window past the breakpoint with the menu open and the
       links come back as a row; leave the flag saying it is open and the
       button would be wrong the next time it narrows. */
    window.addEventListener("resize", function () {
      if (getComputedStyle(btn).display === "none") set(false);
    }, { passive: true });
  }

  function start() { ready(); menu(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
