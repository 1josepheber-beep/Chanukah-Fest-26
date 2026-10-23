/* Write the live wording into the pages themselves.

   Everything typed into the editor lives in a Google Sheet, and the pages
   only look right because a script fetches it and swaps the words in. That
   makes the sheet load-bearing: unreachable sheet, weeks-old page. It also
   means a copy of a page pasted anywhere that forbids scripts -- the Chabad
   CMS, for one -- shows the original draft with its placeholders.

   Rather than reimplement what the runtime does, this loads each page with
   the real content.js and the real values, lets it finish, and freezes what
   the browser ends up with. Whatever the runtime does -- blanking fields,
   hiding a card whose words have gone, rendering a time, formatting money,
   rewriting the sponsorship summary -- is in the result by construction,
   because the runtime did it.

   Three things are undone afterwards, all of them traces of the script
   having run rather than content:

     cfjs on <html>   says scripting is available. Baked in, a page with no
                      script would hide its links behind a button that
                      cannot open.
     the top button   is built by script; it rebuilds itself on load, and
                      left in the markup it would be dead wherever scripts
                      do not run.
     data-cf-was      bookkeeping the map drawing leaves behind.

   Run:  node tools/bake.js
*/
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const REPO = path.dirname(__dirname);
const DATA = process.argv[2];
const BASE = "http://localhost:8099/Chanukah-Fest-26/";

const PAGES = [
  ["index.html", ""],
  ["sponsor/index.html", "sponsor/"],
  ["vendor/index.html", "vendor/"],
  ["volunteer/index.html", "volunteer/"],
  ["raffle/index.html", "raffle/"],
];

(async () => {
  const store = fs.readFileSync(DATA, "utf8");
  const browser = await chromium.launch();

  for (const [file, where] of PAGES) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
      reducedMotion: "reduce",
    });
    // the page asks Google for its words; hand it the words instead
    await ctx.route("**/macros/s/**", r =>
      r.fulfill({ status: 200, contentType: "application/json", body: store }));
    await ctx.route("**google.com/maps**", r => r.abort());

    const pg = await ctx.newPage();
    const errs = [];
    pg.on("pageerror", e => errs.push(e.message));
    await pg.goto(BASE + where, { waitUntil: "domcontentloaded" });
    await pg.waitForTimeout(2600);      // the fetch, then every tidying pass
    if (errs.length) throw new Error(file + ": " + errs[0]);

    const out = await pg.evaluate(() => {
      const d = document;
      d.documentElement.classList.remove("cfjs");
      if (!d.documentElement.className.trim()) d.documentElement.removeAttribute("class");

      const top = d.querySelector(".cftop");
      if (top) top.remove();

      // data-cf-map-was is the address the map falls back to, not a trace
      // of the script having run. Stripping it left the map with nothing
      // to rebuild from.

      // what the runtime decided, so it holds without the runtime
      return "<!doctype html>\n" + d.documentElement.outerHTML + "\n";
    });

    fs.writeFileSync(path.join(REPO, file), out, "utf8");

    const blanks = (out.match(/data-cf-blank/g) || []).length;
    const gone = (out.match(/data-cf-gone/g) || []).length;
    const left = (out.match(/\[\[/g) || []).length;
    console.log(
      `  ${file.padEnd(22)} ${String(out.length).padStart(7)} bytes  ` +
      `blank:${String(blanks).padStart(3)}  hidden:${String(gone).padStart(3)}  [[ ]] left:${left}`);
    await ctx.close();
  }
  await browser.close();
})();
