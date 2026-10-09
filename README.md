# Chanukah Fest 2026

The 31st Annual Grand Menorah Lighting, Houston City Hall,
Sunday 6 December 2026.

## Pages

| URL | What it is |
|---|---|
| `/` | Main festival page: schedule, stage, food, location, questions |
| `/raffle/` | Free raffle entry form. This is where the QR code points. |
| `/sponsor/` | Sponsorship levels and application |
| `/vendor/` | Vendor booth application |

Volunteer, Performers and Location still live on chabadoutreach.org and
are linked out to.

## Why these pages are here and not in the Chabad CMS

The CMS removes JavaScript from anything pasted into an article. Without
it a form cannot check fields before sending, cannot highlight what is
wrong, and cannot show a confirmation without jumping to another page.
Everything here depends on that, so it is hosted instead.

The CMS still holds short intro pages that link across to these.

## Where submissions go

All three forms post to one Google Apps Script attached to the Chanukah
Fest spreadsheet. Each writes to its own tab:

| Form | Tab |
|---|---|
| Raffle | `Entries`, with winners recorded in `Winners` |
| Vendor | `Vendors` |
| Sponsor | `Sponsors` |

The script also blocks duplicate raffle entries by phone number and email,
and emails raffle winners when they are drawn.

No secrets are stored in these files. The script address is a public
submission endpoint. Reading the entrant list needs a key, and that key is
only in the draw screen, which is not published here.

## How the forms behave

* Required fields turn red, with a message, and the page scrolls to the
  first problem. Nothing is submitted and nothing is lost.
* The confirmation replaces the form in place. No second page, no Back
  button.
* Submission posts into a hidden frame, so it needs no cross-origin
  permission and works in every browser.
* On the raffle, a family row only requires both names once something has
  been typed into it, so a half-filled row can be cleared instead of
  blocking the entry.

## Files

```
index.html            festival page
raffle/index.html     raffle entry form
sponsor/index.html    sponsorship
vendor/index.html     vendor application
assets/forms.js       shared validation for sponsor and vendor
```

The raffle form carries its own script because it also manages the
family rows.

## Still to fill in

Anything shown in yellow with a dashed underline is a placeholder.
Search the files for `[[` to find them all: prize names, deadlines,
sponsorship benefits, performer set times, the two vendor PDF links,
and the expected attendance figure.

## Updating

Edit and push. GitHub Pages republishes within a minute or two.
Hard refresh (Ctrl+F5) if an old version is cached.
