/* What people actually do here.

   Google's own measurement already counts visits, how far down a page
   people get, and clicks that leave for another site. What it cannot
   know is what any of the buttons mean. Left to itself it reports a
   list of web addresses, and working out that /raffle/ is the thing
   people came for is a job somebody has to do every time they look.

   So every button says its own name. A name written into the markup
   wins over the words on the button, because the wording can be
   changed in the editor, and a report that quietly renames itself
   halfway through December is worse than no report at all.

   Nothing here is required for the site to work. If the measurement
   script is blocked, or never loads, every call below turns into
   nothing and the page carries on.

   Three events, which is enough to answer most questions:

     cta_click    a button or link was pressed. Carries its name, the
                  section it sits in, and where it goes.
     nav_click    the header, kept separate so it does not drown out
                  the buttons that matter.
     form_start   somebody typed into a form for the first time.
     form_submit  and they sent it. The gap between those two is
                  usually the most useful number on a site like this.
*/
(function () {
  "use strict";

  function fire(name, params) {
    if (typeof window.gtag !== "function") return;   /* blocked, or not loaded */
    try { window.gtag("event", name, params); } catch (e) {}
  }

  function words(s) {
    return String(s || "").replace(/\s+/g, " ").trim().slice(0, 90);
  }

  function naming(el) {
    return el.getAttribute("data-ev") ||
           words(el.textContent) ||
           words(el.getAttribute("aria-label")) ||
           words(el.getAttribute("title")) ||
           words(el.getAttribute("href")) ||
           "(unnamed)";
  }

  /* Which part of the page it sits in, so the same wording in two
     places does not collapse into one line in the report. */
  function where(el) {
    var sec = el.closest && el.closest("[data-cf-sec]");
    if (sec) return sec.getAttribute("data-cf-sec") || "page";
    var any = el.closest && el.closest("[id]");
    return (any && any.id) || "page";
  }

  function kind(href) {
    if (!href) return "button";
    if (href.indexOf("mailto:") === 0) return "email";
    if (href.indexOf("tel:") === 0) return "phone";
    if (href.charAt(0) === "#") return "jump";
    if (/^https?:/i.test(href) && href.indexOf(location.host) === -1) return "offsite";
    return "page";
  }

  /* Capture, so a handler that stops the event further down cannot
     hide the press from us. */
  document.addEventListener("click", function (ev) {
    var el = ev.target && ev.target.closest && ev.target.closest("a,button");
    if (!el) return;

    if (el.className && String(el.className).indexOf("cfnav-link") > -1) {
      fire("nav_click", { cta: naming(el), section: where(el) });
      return;
    }

    var href = el.getAttribute("href");
    fire("cta_click", {
      cta: naming(el),
      section: where(el),
      target_kind: kind(href),
      destination: href || ""
    });
  }, true);

  function formName(f) {
    return f.getAttribute("data-ev") || f.id ||
           words(location.pathname.replace(/\//g, " ")) || "form";
  }

  Array.prototype.forEach.call(document.querySelectorAll("form"), function (f) {
    var begun = false;

    f.addEventListener("input", function () {
      if (begun) return;
      begun = true;                                  /* once per visit, not per keystroke */
      fire("form_start", { form_name: formName(f) });
    }, true);

    /* A form with a required field left empty never fires this: the
       browser stops it first. So this counts applications actually
       sent, not attempts. */
    f.addEventListener("submit", function () {
      fire("form_submit", { form_name: formName(f) });
    }, true);
  });
})();
