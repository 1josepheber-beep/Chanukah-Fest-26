/* Applies whatever has been changed in the admin page.

   Every page still ships with its real wording baked into the HTML, so
   it renders instantly and reads correctly even if Google is
   unreachable. This file only ever puts *differences* on top.

   Three sources, in order:
     1. what this browser saw last time, applied before first paint
     2. what the spreadsheet says now, applied when it arrives
     3. the admin page, when this page is open inside its preview

   The first one is what stops edited text flashing from old to new on
   every visit. A browser that has never been here simply sees the
   baked-in wording for a moment longer. */

(function () {
  "use strict";

  var API = "https://script.google.com/macros/s/AKfycbzwDkEPx2ioKaDoiBkkZNm37rI4ox4MiVe8v3fk138SWPDx66XJy5BD4TErWS3eLhJ5/exec";
  var CACHE = "cf26-content-v1";

  var PAGE = (function () {
    var p = location.pathname.replace(/\/index\.html$/, "/").replace(/\/+$/, "/");
    var m = p.match(/\/(raffle|sponsor|vendor|volunteer|draw)\/$/);
    return m ? m[1] : "index";
  })();

  /* ---------------------------------------------------------------- apply */

  function text(el, value) {
    // textContent, not innerHTML: nothing typed into the admin page
    // should ever be able to put markup or script into a live page.
    el.textContent = value;
  }

  /* Emptying a field has to take the element with it. A placeholder is
     a highlighted box with a dashed underline; cleared of its text it
     would otherwise sit there as a small coloured stub. */
  function setText(el, v) {
    text(el, v);
    if (String(v).trim() === "") el.setAttribute("data-cf-blank", "");
    else el.removeAttribute("data-cf-blank");
  }

  function applyFields(data) {
    if (!data) return;
    var by = data.fields || {};

    each("[data-cf]", function (el) {
      var v = by[el.getAttribute("data-cf")];
      if (v != null) setText(el, v);
    });
    each("[data-cf-href]", function (el) {
      var v = by[el.getAttribute("data-cf-href")];
      if (v != null) el.setAttribute("href", v);
    });
    each("[data-cf-ph]", function (el) {
      var v = by[el.getAttribute("data-cf-ph")];
      if (v != null) el.setAttribute("placeholder", v);
    });
    each("[data-cf-img]", function (el) {
      var v = by[el.getAttribute("data-cf-img")];
      if (v != null) el.setAttribute("src", v);
    });
  }

  /* Set on the element rather than in a stylesheet. Each page declares
     its palette in a <style> inside the body, which comes after <head>
     in source order and would therefore beat a rule appended there. An
     inline custom property on :root sits above both. */
  var colourSet = [];
  function applyColours(data) {
    var c = (data && data.colours) || {};
    var root = document.documentElement;

    colourSet.forEach(function (name) {
      if (!(name in c)) root.style.removeProperty("--" + name);
    });
    colourSet = [];

    for (var name in c) {
      if (/^[a-z0-9-]+$/.test(name) && /^#[0-9A-Fa-f]{3,8}$/.test(c[name])) {
        root.style.setProperty("--" + name, c[name]);
        colourSet.push(name);
      }
    }
  }

  /* Sections are moved by actually moving them. Switching their parent
     to flex and using `order` would be less code, but it would change
     how every one of them is laid out. */
  /* Every block carries its own display rule, and a class selector beats
     the hidden attribute, so hiding has to be stated outright. */
  function hideRule() {
    if (document.getElementById("cf-hide")) return;
    var tag = document.createElement("style");
    tag.id = "cf-hide";
    /* Someone will type a sentence into a box built for two words. A
       flex or grid child refuses to shrink below its content unless it
       is told it may, which is what pushes the whole page sideways. */
    tag.textContent =
      "[data-cf-sec][hidden]{display:none !important}" +
      "[data-cf][data-cf-blank]{display:none !important}" +
      "[data-cf]{min-width:0;overflow-wrap:break-word}";
    (document.head || document.documentElement).appendChild(tag);
  }

  function applySections(data) {
    hideRule();
    var s = data && data.sections && data.sections[PAGE];
    if (!s) return;

    each("[data-cf-sec]", function (el) {
      var rule = s[el.getAttribute("data-cf-sec")];
      if (rule && rule.hidden) el.setAttribute("hidden", "hidden");
      else el.removeAttribute("hidden");
    });

    var order = [];
    each("[data-cf-sec]", function (el) {
      var id = el.getAttribute("data-cf-sec");
      var rule = s[id] || {};
      order.push({ el: el, at: rule.at == null ? 9999 : rule.at });
    });
    if (!order.length) return;

    var parent = order[0].el.parentNode;
    if (!order.every(function (o) { return o.el.parentNode === parent; })) return;

    order.sort(function (a, b) { return a.at - b.at; });
    order.forEach(function (o) { parent.appendChild(o.el); });
  }

  /* A price is set not to wrap, and a flex item will not shrink below
     its own content — both right for the wording these pages were built
     with, both able to push the page sideways when someone types a
     sentence into a box meant for two words. Forcing either everywhere
     would change the layout of pages nobody has edited, so this only
     intervenes once the page has actually gone too wide, and only then. */
  function keepItInside() {
    var html = document.documentElement;
    if (html.scrollWidth <= html.clientWidth + 2) return;
    if (document.getElementById("cf-fit")) return;
    var tag = document.createElement("style");
    tag.id = "cf-fit";
    tag.textContent = "[data-cf-sec] *{min-width:0}" +
                      "[data-cf]{white-space:normal;overflow-wrap:break-word}";
    document.head.appendChild(tag);
  }

  function applyAll(data) {
    if (!data) return;
    try { hideRule(); } catch (e) {}
    try { applyFields(data); } catch (e) {}
    try { applyColours(data); } catch (e) {}
    try { applySections(data); } catch (e) {}
    // after layout has settled
    try { requestAnimationFrame(keepItInside); } catch (e) { keepItInside(); }
  }

  function each(sel, fn) {
    var all = document.querySelectorAll(sel);
    for (var i = 0; i < all.length; i++) fn(all[i]);
  }

  /* ---------------------------------------------------------------- load */

  function cached() {
    try { return JSON.parse(localStorage.getItem(CACHE) || "null"); }
    catch (e) { return null; }
  }

  function remember(data) {
    try { localStorage.setItem(CACHE, JSON.stringify(data)); } catch (e) {}
  }

  function fetchLive() {
    var url = API + "?action=content&t=" + Date.now();
    if (!window.fetch) return;
    fetch(url, { method: "GET" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok) return;
        remember(d);
        applyAll(d);
      })
      .catch(function () { /* the baked-in wording is already correct */ });
  }

  /* --------------------------------------------------- the admin preview */

  function listenForPreview() {
    addEventListener("message", function (e) {
      var m = e.data;
      if (!m || m.cf !== "preview") return;
      applyAll(m.data);
    });
    if (parent !== window) parent.postMessage({ cf: "ready", page: PAGE }, "*");
  }

  /* ---------------------------------------------------------------- go */

  applyAll(cached());          // before paint, from what we saw last time

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyAll(cached());      // again, now the whole page exists
      listenForPreview();
      fetchLive();
    });
  } else {
    listenForPreview();
    fetchLive();
  }
})();
