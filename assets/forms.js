/* Shared behaviour for the vendor and sponsor applications.
   The raffle form has its own copy, because it also manages family rows.

   Three jobs:
     1. Check every required control before anything is sent, mark what
        is wrong in red and scroll to the first problem.
     2. Post into a hidden frame so the page never navigates away.
     3. Put the confirmation where the form was.

   Nothing here depends on a particular class prefix, so the same file
   drives both forms. */

(function () {
  "use strict";

  var BAD = "cf-bad";
  var MSG = "cf-errmsg";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function digits(v) { return String(v || "").replace(/\D/g, ""); }

  function looksLikeEmail(v) {
    v = String(v || "").trim();
    return v.length >= 5 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  /* The box we paint red. A text input lives in a "…-field" wrapper; a
     tickbox is its own "…-opt" label; a set of radio buttons is marked
     as a whole, on the "…-opts" wrapper, because no single one of them
     is at fault. */
  function containerFor(el) {
    if (el.type === "radio") {
      var group = el.closest('[class*="-opts"]');
      if (group) return group;
    }
    return el.closest('[class*="-field"]') ||
           el.closest('[class*="-opt"]') ||
           el.parentNode;
  }

  function sameName(form, el) {
    return form.querySelectorAll('[name="' + el.name + '"]');
  }

  function isValid(form, el) {
    if (el.type === "radio") {
      var all = sameName(form, el);
      for (var i = 0; i < all.length; i++) if (all[i].checked) return true;
      return false;
    }
    if (el.type === "checkbox") return el.checked;

    var v = String(el.value || "").trim();
    if (!v) return false;
    if (el.type === "email") return looksLikeEmail(v);
    if (el.type === "tel") return digits(v).length >= 10;
    return true;
  }

  function reasonFor(el) {
    if (el.type === "radio") return "Please choose one.";
    if (el.type === "checkbox") return "Please tick this to continue.";
    if (el.type === "email") return "Please enter a valid email address.";
    if (el.type === "tel") return "Please enter a phone number with at least 10 digits.";
    if (el.tagName === "TEXTAREA") return "Please fill this in.";
    return "Please fill this in.";
  }

  function messageEl(box) {
    var m = box.querySelector("." + MSG);
    if (!m) {
      m = document.createElement("div");
      m.className = MSG;
      box.appendChild(m);
    }
    return m;
  }

  function mark(box, bad, why) {
    box.classList.toggle(BAD, bad);
    if (bad) messageEl(box).textContent = why;
  }

  ready(function () {
    var forms = document.querySelectorAll("form[data-cf-form]");

    Array.prototype.forEach.call(forms, function (form) {
      var sink = document.getElementById(form.getAttribute("data-cf-sink"));
      var done = document.getElementById(form.getAttribute("data-cf-done"));
      var summary = document.getElementById(form.getAttribute("data-cf-summary"));
      var btn = form.querySelector('[type="submit"]');

      function required() {
        return Array.prototype.slice.call(form.querySelectorAll("[required]"));
      }

      // Clear a mark as soon as the person fixes it.
      form.addEventListener("input", recheck);
      form.addEventListener("change", recheck);

      function recheck(e) {
        var el = e.target;
        if (!el.name) return;
        var box = containerFor(el);
        if (!box || !box.classList.contains(BAD)) return;

        // A radio group is judged by the group, not the one just clicked.
        var probe = el.hasAttribute("required") ? el :
                    form.querySelector('[name="' + el.name + '"][required]');
        if (probe && isValid(form, probe)) {
          mark(box, false);
          if (summary && !form.querySelector("." + BAD)) summary.classList.remove("cf-show");
        }
      }

      form.addEventListener("submit", function (e) {
        var list = required();
        var firstBad = null;
        var count = 0;
        var seen = {};

        for (var i = 0; i < list.length; i++) {
          var el = list[i];
          if (el.type === "radio") {
            if (seen[el.name]) continue;   // one verdict per group
            seen[el.name] = true;
          }
          var box = containerFor(el);
          var ok = isValid(form, el);
          mark(box, !ok, reasonFor(el));
          if (!ok) {
            count++;
            if (!firstBad) firstBad = { box: box, el: el };
          }
        }

        if (firstBad) {
          e.preventDefault();
          if (summary) {
            summary.textContent = count === 1
              ? "One field needs your attention — it's highlighted above."
              : count + " fields need your attention — they're highlighted above.";
            summary.classList.add("cf-show");
          }
          firstBad.box.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(function () {
            try { firstBad.el.focus({ preventScroll: true }); } catch (err) { firstBad.el.focus(); }
          }, 320);
          return;
        }

        if (summary) summary.classList.remove("cf-show");
        if (btn) {
          btn.disabled = true;
          btn.textContent = btn.getAttribute("data-cf-sending") || "Sending…";
        }

        // The browser posts into the hidden frame from here. Show the
        // confirmation straight away rather than waiting on a reply we
        // are not allowed to read.
        if (done) {
          form.hidden = true;
          done.classList.add("cf-show");
          done.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(function () {
            try { done.focus({ preventScroll: true }); } catch (err) {}
          }, 300);
        }
      });

      // Keep the frame reference alive even if nothing else uses it.
      if (sink && form.target !== sink.name) form.target = sink.name;
    });
  });
})();
