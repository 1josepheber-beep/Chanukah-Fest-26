/* Add to calendar.

   The date chip in the hero opens a two-item menu: Google, or a .ics file
   for Apple Calendar and Outlook. What goes into the calendar entry does
   not come from the chip's own wording -- the chip can say whatever reads
   well -- but from four fields kept out of sight next to it, so the entry
   stays exact however the chip is worded.

   Everything is read at click time rather than at load, because the site's
   text arrives from the sheet a moment after the page does. */
(function () {
  "use strict";

  var TZ = "America/Chicago";

  function field(name) {
    var el = document.querySelector('[data-cf="hero.cal-' + name + '"]');
    return el ? el.textContent.trim() : "";
  }

  /* "2026-12-06 15:00" -> "20261206T150000". Anything else -> "". */
  function stamp(text) {
    var m = String(text || "").trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
    if (!m) return "";
    var hh = m[4].length === 1 ? "0" + m[4] : m[4];
    return m[1] + m[2] + m[3] + "T" + hh + m[5] + "00";
  }

  function utcStamp(d) {
    function two(n) { return n < 10 ? "0" + n : "" + n; }
    return d.getUTCFullYear() + two(d.getUTCMonth() + 1) + two(d.getUTCDate()) +
           "T" + two(d.getUTCHours()) + two(d.getUTCMinutes()) + two(d.getUTCSeconds()) + "Z";
  }

  function details() {
    var start = stamp(field("start")), end = stamp(field("end"));
    if (!start || !end) return null;
    return {
      title: field("title") || document.title,
      place: field("place"),
      start: start,
      end: end,
      url: location.origin + location.pathname
    };
  }

  function googleUrl(e) {
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(e.title) +
      "&dates=" + e.start + "/" + e.end +
      "&ctz=" + encodeURIComponent(TZ) +
      "&location=" + encodeURIComponent(e.place) +
      "&details=" + encodeURIComponent(e.url);
  }

  /* A floating local time means nothing without the rule that turns it into
     a real one, so the zone travels with the file. Writing the times in UTC
     instead would go wrong the moment anyone edits the date into daylight
     time. */
  var VTIMEZONE = [
    "BEGIN:VTIMEZONE",
    "TZID:America/Chicago",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0600",
    "TZOFFSETTO:-0500",
    "TZNAME:CDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0600",
    "TZNAME:CST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE"
  ];

  function esc(v) {
    return String(v || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;")
                          .replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }

  function icsText(e) {
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Houston Chanukah Fest//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ].concat(VTIMEZONE).concat([
      "BEGIN:VEVENT",
      "UID:" + e.start + "-chanukahfest@" + location.hostname,
      "DTSTAMP:" + utcStamp(new Date()),
      "DTSTART;TZID=" + TZ + ":" + e.start,
      "DTEND;TZID=" + TZ + ":" + e.end,
      "SUMMARY:" + esc(e.title),
      "LOCATION:" + esc(e.place),
      "URL:" + esc(e.url),
      "DESCRIPTION:" + esc(e.url),
      "END:VEVENT",
      "END:VCALENDAR"
    ]).join("\r\n");
  }

  function ready() {
    var wrap = document.querySelector(".cf26-cal");
    if (!wrap) return;
    var btn = wrap.querySelector(".cf26-fact-cal");
    var menu = wrap.querySelector(".cf26-cal-menu");
    var gcal = wrap.querySelector('[data-cal="google"]');
    var ics = wrap.querySelector('[data-cal="ics"]');
    if (!btn || !menu || !gcal || !ics) return;

    var objectUrl = null;

    function close() {
      menu.setAttribute("hidden", "hidden");
      btn.setAttribute("aria-expanded", "false");
    }

    function open() {
      var e = details();
      if (!e) return;                 /* no usable date: behave like a plain chip */
      gcal.href = googleUrl(e);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(
        new Blob([icsText(e)], { type: "text/calendar;charset=utf-8" }));
      ics.href = objectUrl;
      menu.removeAttribute("hidden");
      btn.setAttribute("aria-expanded", "true");
    }

    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (menu.hasAttribute("hidden")) open(); else close();
    });

    /* The sheet's text lands a moment after the page does, so whether the
       dates are usable can only be judged once, late -- not at load, when
       the markup still holds its built-in defaults. */
    setTimeout(function () {
      var usable = !!details();
      btn.setAttribute("aria-disabled", usable ? "false" : "true");
      btn.style.cursor = usable ? "" : "default";
    }, 2500);

    document.addEventListener("click", function (ev) {
      if (!wrap.contains(ev.target)) close();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") close();
    });
    menu.addEventListener("click", function () { setTimeout(close, 60); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
