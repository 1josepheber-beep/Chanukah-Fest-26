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
  /* The line break beside an emptied line has to go with it. "Address"
     is two lines with a <br> between them; clearing one of them left the
     break behind, and with it a blank line where the writing used to be. */
  function nextTag(el, back) {
    var n = back ? el.previousSibling : el.nextSibling;
    while (n && n.nodeType === 3 && !n.nodeValue.trim()) {
      n = back ? n.previousSibling : n.nextSibling;
    }
    return n && n.nodeType === 1 ? n : null;
  }

  /* A field cleared down to a stray full stop or bullet is empty as far
     as anyone reading the page is concerned, but it still drew a dot
     where the words used to be. Anything with no letters or digits in
     it counts as cleared. Nothing on this site is legitimately
     punctuation on its own — checked against all 600 fields. */
  var HAS_WORDS = /[0-9A-Za-z\u00c0-\u024f\u0590-\u05ff]/;

  function setText(el, v) {
    text(el, v);
    if (!HAS_WORDS.test(String(v))) el.setAttribute("data-cf-blank", "");
    else el.removeAttribute("data-cf-blank");
  }

  /* Decided per break, not per line. Deciding it per line meant the
     second line put back the break the first line had just taken away. */
  function tidyBreaks() {
    each("br", function (br) {
      var before = nextTag(br, true), after = nextTag(br, false);
      var dead = function (n) { return n && n.hasAttribute && n.hasAttribute("data-cf-blank"); };
      if (dead(before) || dead(after)) br.setAttribute("data-cf-gone", "");
      else br.removeAttribute("data-cf-gone");
    });
  }

  /* The yellow box with the dashed underline means "someone still has to
     write this". It lives on a class, so it stayed put once the words
     were written. Anything that no longer reads [[ LIKE THIS ]] has been
     filled in and stops being marked.

     Set on the element, with important. The page says
     `.cf26-fill { background-color: ... !important }`, which beats both
     a plain inline style and any rule of ours appended to <head>, since
     the page's own stylesheet sits later in the document. */
  var UNMARK = [["background", "none"], ["color", "inherit"],
                ["border-bottom", "0"], ["padding", "0"],
                ["font-weight", "inherit"]];

  function tidyHighlights() {
    each("[class*='26-fill']", function (el) {
      var stillBlank = /\[\[[\s\S]*\]\]/.test(el.textContent);
      if (stillBlank) {
        el.removeAttribute("data-cf-done");
        UNMARK.forEach(function (d) { el.style.removeProperty(d[0]); });
      } else {
        el.setAttribute("data-cf-done", "");
        UNMARK.forEach(function (d) { el.style.setProperty(d[0], d[1], "important"); });
      }
    });
  }

  /* A card whose words have all been cleared is still a card: a photo
     with nothing under it. Merge two acts into one and the card you
     emptied stays on the page as a picture with no caption. If every
     editable piece of text in the body has gone, the card goes too --
     and comes straight back the moment anything is typed into it. */
  function tidyCards() {
    each(".cf26-act", function (card) {
      var body = card.querySelector(".cf26-act-body");
      if (!body) return;
      var bound = body.querySelectorAll("[data-cf]");
      if (!bound.length) return;            /* nothing editable: not ours to hide */
      var anyWords = false;
      for (var i = 0; i < bound.length; i++) {
        if (!bound[i].hasAttribute("data-cf-blank")) { anyWords = true; break; }
      }
      if (anyWords) card.removeAttribute("data-cf-gone");
      else card.setAttribute("data-cf-gone", "");
    });
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
    each("[data-cf-map]", function (el) {
      var v = by[el.getAttribute("data-cf-map")];
      drawMap(el, v == null ? el.getAttribute("data-cf-map-was") : v);
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
  /* Whatever is typed here becomes a query, and the map address is
     built from it. The pasted link is never used as the frame's address
     directly: that would let anything at all be put in a frame on the
     page, and a Google share link is not an embeddable address anyway. */
  function mapQuery(text) {
    text = String(text || "").trim();
    if (!text) return "";

    var at = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);       // ...@29.76,-95.37,17z
    if (at) return at[1] + "," + at[2];

    var place = text.match(/\/place\/([^\/?@]+)/);              // .../place/Houston+City+Hall/
    if (place) return decodeURIComponent(place[1]).replace(/\+/g, " ");

    var q = text.match(/[?&]q=([^&]+)/);
    if (q) return decodeURIComponent(q[1]).replace(/\+/g, " ");

    if (/^https?:\/\//i.test(text)) return "";                  // a link we cannot read
    return text;                                                 // a plain address
  }

  function drawMap(el, text) {
    if (!el.getAttribute("data-cf-map-was")) {
      el.setAttribute("data-cf-map-was", el.textContent.trim());
    }
    var q = mapQuery(text);
    if (!q) {                        // nothing usable: leave the empty box
      el.classList.remove("cf26-map-on");
      el.textContent = String(text || "").trim() ||
                       el.getAttribute("data-cf-map-was") || "";
      return;
    }
    var src = "https://www.google.com/maps?q=" + encodeURIComponent(q) + "&output=embed";
    var frame = el.querySelector("iframe");
    if (frame && frame.getAttribute("src") === src) return;
    el.textContent = "";
    frame = document.createElement("iframe");
    frame.setAttribute("src", src);
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    frame.setAttribute("title", "Map");
    el.appendChild(frame);
    el.classList.add("cf26-map-on");
  }

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
      "[data-cf-gone]{display:none !important}" +
      "[data-cf][data-cf-blank]{display:none !important}" +
      "[data-cf]{overflow-wrap:anywhere}";
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

    /* Hiding a block has to take its jump link with it, or the menu is
       left pointing at something that is no longer on the page. Most
       anchors are named after their block; these three are not. */
    var ALIAS = { schedule: "sched", location: "loc", questions: "faq" };
    each('a[href^="#"]', function (a) {
      var target = a.getAttribute("href").slice(1);
      var rule = s[ALIAS[target] || target];
      if (rule && rule.hidden) a.setAttribute("data-cf-gone", "");
      else a.removeAttribute("data-cf-gone");
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
                      "[data-cf]{min-width:0;white-space:normal;overflow-wrap:break-word}";
    document.head.appendChild(tag);
  }

  function applyAll(data) {
    if (!data) return;
    try { hideRule(); } catch (e) {}
    try { applyFields(data); } catch (e) {}
    try { tidyBreaks(); } catch (e) {}
    try { tidyHighlights(); } catch (e) {}
    try { tidyCards(); } catch (e) {}
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

  /* Two ways in. A plain fetch is cleaner, but an Apps Script answer
     arrives via a redirect to a different Google host, and a browser
     that objects to that leaves the page showing its built-in wording
     for ever. A script tag is not subject to that, so it gets a turn
     if the fetch has not landed. */
  function fetchLive(after) {
    var url = API + "?action=content&t=" + Date.now();
    var landed = false;

    function land(d) {
      if (landed || !d || !d.ok) return;
      landed = true;
      remember(d);
      applyAll(d);
      if (after) after(d);
    }

    function viaScript() {
      if (landed) return;
      var name = "cfContent" + Math.floor(Math.random() * 1e9);
      var tag = document.createElement("script");
      window[name] = function (d) {
        land(d);
        try { delete window[name]; } catch (e) { window[name] = undefined; }
        if (tag.parentNode) tag.parentNode.removeChild(tag);
      };
      tag.src = url + "&callback=" + name;
      tag.onerror = function () { if (tag.parentNode) tag.parentNode.removeChild(tag); };
      (document.head || document.documentElement).appendChild(tag);
    }

    if (window.fetch) {
      fetch(url, { method: "GET" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(land)
        .catch(viaScript);
      setTimeout(viaScript, 3500);      // fetch neither failed nor answered
    } else {
      viaScript();
    }
  }

  // so the editor and a person looking at the page can both ask
  window.cfReload = fetchLive;
  window.cfForget = function () {
    try { localStorage.removeItem(CACHE); } catch (e) {}
    location.reload();
  };

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

  function tidyOnce() {
    try { hideRule(); tidyHighlights(); tidyCards(); } catch (e) {}
    try { each("[data-cf-map]", function (el) { drawMap(el, el.textContent); }); } catch (e) {}
  }

  applyAll(cached());          // before paint, from what we saw last time

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applyAll(cached());      // again, now the whole page exists
      tidyOnce();
      listenForPreview();
      fetchLive();
    });
  } else {
    tidyOnce();
    listenForPreview();
    fetchLive();
  }
})();
