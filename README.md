# Chanukah Fest 2026

Pages for the 31st Annual Chanukah Fest and Grand Menorah Lighting,
Houston City Hall, Sunday 6 December 2026.

## What is here

| File | What it is |
|---|---|
| `index.html` | The raffle entry form. This is the page the QR code points at. |

## Why this page is not on chabadoutreach.org

The Chabad CMS removes JavaScript from anything pasted into an article.
Without JavaScript the form cannot check fields before sending, and it
cannot show a confirmation without jumping to a separate page. Hosting it
here keeps both.

Everything else — the main festival page, sponsorship, vendor, and the
raffle intro page with the button through to this form — stays in the CMS.

## Where the entries go

The form posts to a Google Apps Script attached to the raffle
spreadsheet. The script records the entry, blocks duplicate phone numbers
and email addresses, and emails winners when they are drawn.

Nothing secret is stored in this file. The script address is a public
submission endpoint; it cannot read the entrant list without a key, and
that key is not here.

## Updating the form

Edit `index.html` and push. GitHub Pages republishes within a minute or
two. Hard refresh (Ctrl+F5) if an old version is cached.
