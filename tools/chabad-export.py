#!/usr/bin/env python3
"""Turn each page into a block that can be pasted into the Chabad CMS.

Two things about that system shape all of this:

  * it parses the page as XML, so a bare & is a parse error and every void
    tag has to close itself; and
  * it takes no <script>.

No script means nothing on these pages can be built at run time. So the
wording has to already be in the HTML -- whatever has been typed into the
editor since is NOT in here unless it has been baked in first -- and the
few things that were drawn by script are either replaced with a static
version or left out:

  add to calendar   the chip stays, the menu goes
  back to top       gone; it was created by script
  the menu button   gone; the links stay as a strip that scrolls
  the map           a plain iframe rather than one built from the address
  the FAQ dropdowns kept: those are native <details> and need no script

Run:  python3 tools/chabad-export.py
"""

import io
import os
import re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = "/mnt/user-data/outputs/chanukah-fest-2026/chabad"
BUILT = "22oct-1855-real-aids"
LIVE = "https://1josepheber-beep.github.io/Chanukah-Fest-26"

# The article ids already in use, from the version of these pages that is
# on the Chabad site now. Raffle never had one.
AID = {
    "index":     "7542663",
    "sponsor":   "7561354",
    "vendor":    "7561401",
    "volunteer": "7561374",
    "raffle":    "7561376",
}

PAGES = [
    ("index",     "index.html",           "1-MAIN-FEST-PAGE"),
    ("sponsor",   "sponsor/index.html",   "2-SPONSORSHIP"),
    ("vendor",    "vendor/index.html",    "3-VENDOR-APPLICATION"),
    ("volunteer", "volunteer/index.html", "4-VOLUNTEER"),
    ("raffle",    "raffle/index.html",    "5-RAFFLE"),
]

VOID = ("img", "br", "hr", "input", "meta", "link", "source", "col")

WARNING = """
     READ THIS BEFORE USING THIS PAGE
     The form on this page needs JavaScript, and there is none here. It
     will still send what is typed, but the person filling it in sees
     nothing happen afterwards -- no thank-you, no error if they missed a
     field -- so most will fill it in again, or give up.

     Unless the CMS turns out to allow scripts, leave this page
     where it is and link to it from the Chabad page instead:
       %s/%s/
""" % (LIVE, "SLUG")


def read(p):
    return io.open(os.path.join(HERE, p), encoding="utf-8").read()


def body_of(html):
    i = html.index("<body>") + len("<body>")
    j = html.index("</body>")
    return html[i:j].strip()


STYLE = re.compile(r"<style[^>]*>(.*?)</style>", re.S)
CSS_COMMENT = re.compile(r"/\*.*?\*/", re.S)


def plain_comments(css):
    """A stylesheet comment that names a tag -- "it is a <button> so..." --
       is just prose here, but to an XML parser that < opens an element and
       the page is refused. The brackets come off; the sentence survives."""
    return CSS_COMMENT.sub(
        lambda m: m.group(0).replace("<", "").replace(">", ""), css)


RULE_HTML_BODY = re.compile(r"html\s*,\s*body\s*\{[^}]*\}", re.I)
ROOT_RULE = re.compile(r":root\s*\{[^}]*\}", re.S)
VAR_DEF = re.compile(r"(--[A-Za-z0-9_-]+)\s*:\s*([^;}]+)")
VAR_USE = re.compile(r"var\(\s*(--[A-Za-z0-9_-]+)\s*\)")


def flatten_vars(css):
    """Write the colours out in full, and retire the custom properties.

       Every colour on the site is named once in a :root block and then
       used through var(--navy) and the like -- 88 times on the main page
       alone. This editor is specified against HTML 4.01 and XHTML 1.0,
       both of which predate custom properties by well over a decade, and
       whatever reads the stylesheet there does not keep that block.

       Each var() then resolves to nothing, and that is not evenly
       damaging. A background falls back to transparent, so a navy band
       turns white; text written as a literal #fff stays white. White
       headings on a white band -- the section looks like a blank gap,
       which is exactly how it came out.

       Substituting the values here leaves nothing to resolve later."""
    names = {}
    for rule in ROOT_RULE.findall(css):
        for name, value in VAR_DEF.findall(rule):
            names[name] = value.strip()

    # a colour may be defined in terms of another; settle those first
    for _ in range(10):
        after = {n: VAR_USE.sub(lambda m: names.get(m.group(1), m.group(0)), v)
                 for n, v in names.items()}
        if after == names:
            break
        names = after

    css = ROOT_RULE.sub("", css)
    for _ in range(10):
        swapped = VAR_USE.sub(lambda m: names.get(m.group(1), m.group(0)), css)
        if swapped == css:
            break
        css = swapped

    # say so rather than ship a colour that resolves to nothing
    left = re.findall(r"var\([^)]*\)", css)
    if left:
        raise SystemExit("  stylesheet still asks for " + left[0] +
                         " and nothing defines it")
    return css


MENU_CSS = """/* ============== THE MENU, WITH NOTHING RUNNING ==============

   On a phone the eight links do not fit, so they fold behind a
   button. That button used to need a script to open it, and there is
   no script here -- which is why the links came back as a strip that
   runs off the edge of the screen with nothing to say so.

   A checkbox needs no script. Clicking a label ticks the checkbox it
   names, which is plain HTML 4 behaviour, and CSS can see the state.
   The label is the button; the checkbox itself is parked off-screen.

   Every rule that folds the links away is written with :checked. If
   this system ever stops understanding that, the whole group is
   ignored: the button stays hidden and the links stay out in the
   open, exactly as they are today. The one outcome worth avoiding is
   a menu that is there but will not open, and this cannot produce it.
*/

.cfnav .cfnav-chk { position: absolute; left: -9999px; }

@media (max-width: 760px) {

  .cfnav .cfnav-chk:checked + .cfnav-toggle,
  .cfnav .cfnav-chk:not(:checked) + .cfnav-toggle {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 11px;
    padding: 15px 16px;
    font-family: "Bricolage Grotesque", "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: #B9CBDE;
    cursor: pointer;
  }

  /* shut unless the box is ticked */
  .cfnav .cfnav-chk:not(:checked) + .cfnav-toggle + .cfnav-inner { display: none; }

  .cfnav .cfnav-chk:checked + .cfnav-toggle + .cfnav-inner {
    padding: 0;
    overflow-x: visible;
    max-height: 70vh;
    overflow-y: auto;
    border-top: 1px solid rgba(255, 255, 255, 0.10);
  }

  /* three bars, drawn rather than typed */
  .cfnav .cfnav-bars {
    display: block;
    width: 19px; height: 2px;
    background: #F0B429;
    box-shadow: 0 6px 0 #F0B429, 0 -6px 0 #F0B429;
  }
  .cfnav .cfnav-chk:checked + .cfnav-toggle .cfnav-bars {
    box-shadow: none;
    transform: rotate(45deg);
    position: relative;
  }
  .cfnav .cfnav-chk:checked + .cfnav-toggle .cfnav-bars::after {
    content: ""; position: absolute; left: 0; top: 0;
    width: 19px; height: 2px; background: #F0B429;
    transform: rotate(-90deg);
  }

  .cfnav .cfnav-chk:checked + .cfnav-toggle + .cfnav-inner .cfnav-row {
    flex-direction: column;
    width: auto;
    gap: 0;
  }
  .cfnav .cfnav-chk:checked + .cfnav-toggle + .cfnav-inner .cfnav-link {
    padding: 14px 16px;
    font-size: 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    border-left: 3px solid transparent;
  }
  .cfnav .cfnav-chk:checked + .cfnav-toggle + .cfnav-inner .cfnav-link-current {
    border-bottom-color: rgba(255, 255, 255, 0.07);
    border-left-color: #F0B429;
  }
}
"""


def one_stylesheet(html, body, nav_css):
    """Three of the pages keep their stylesheet in the head and two in the
       body, and nav.css is a file of its own. A pasted block has no head,
       so all of it is gathered into a single <style> at the top.

       Every block is gathered. An earlier version skipped any block that
       set a background on html and body, so as not to paint over the
       colour the CMS page already carries -- but it skipped the whole
       block, and it only ever looked in the head. On the two pages that
       keep their stylesheet there, that one small rule cost them the
       entire design: volunteer and raffle went out with the header
       styling and nothing else at all. Only the rule itself goes now,
       and from wherever it happens to sit."""
    head = html[:html.index("<body>")]
    parts = []
    for css in STYLE.findall(head):
        parts.append(plain_comments(RULE_HTML_BODY.sub("", css).strip()))
    parts.append("/* ============== SITE HEADER ============== */\n" + plain_comments(nav_css.strip()))
    parts.append(plain_comments(MENU_CSS.strip()))
    for css in STYLE.findall(body):
        parts.append(plain_comments(RULE_HTML_BODY.sub("", css).strip()))
    body = STYLE.sub("", body).lstrip()
    sheet = flatten_vars("\n\n".join(p for p in parts if p))
    return '<style type="text/css">\n%s\n</style>\n\n%s' % (sheet, body)


def drop_script_only_bits(body):
    # two of the pages carry their form handler inline; it cannot come
    body = re.sub(r"\s*<script\b[^>]*>.*?</script>", "", body, flags=re.S)

    # The menu button needed a script to open, so it used to be dropped
    # and the links left as a strip. A label and its own checkbox do the
    # same job with nothing running; the bars and the wording come across
    # unchanged. MENU_CSS above folds the links away.
    body = re.sub(
        r'\s*<button type="button" class="cfnav-toggle"[^>]*>(.*?)</button>',
        lambda m: ('\n    <input type="checkbox" id="cfnavopen" class="cfnav-chk" />'
                   '\n    <label for="cfnavopen" class="cfnav-toggle">%s</label>'
                   % m.group(1).strip()),
        body, flags=re.S)

    # the date chip: keep the words, lose the menu it used to open
    body = re.sub(
        r'<span class="cf26-cal">\s*<button[^>]*class="cf26-fact cf26-fact-cal"[^>]*'
        r'data-cf="([^"]+)"[^>]*>(.*?)</button>.*?</span>\s*</span>',
        lambda m: '<span class="cf26-fact" data-cf="%s">%s</span>' % (m.group(1), m.group(2)),
        body, flags=re.S)

    # The fields that fed it are no use with nothing to read them.
    # Anchored on the last of them: a lazy match for the closing tag stops
    # at the first inner span and leaves the rest of the block orphaned.
    body = re.sub(r'\s*<!-- What the "add to calendar".*?'
                  r'data-cf="hero\.cal-place">[^<]*</span>\s*</span>', "",
                  body, flags=re.S)
    return body


MARKED = re.compile(r"<([a-zA-Z][-\w]*)\b[^>]*?\bdata-cf-(?:gone|blank)\b[^>]*?(/?)>")


def cut_marked(body):
    """Remove each element the runtime marked unseen, and everything inside
       it. A non-greedy match cannot do this: a span holding spans closes on
       the first </span> it meets, which is the inner one, and the rest of
       the document comes apart. So the nesting is counted."""
    while True:
        m = MARKED.search(body)
        if not m:
            return body
        tag, selfclose = m.group(1), m.group(2)
        if selfclose or tag.lower() in VOID:
            body = body[:m.start()] + body[m.end():]
            continue
        depth, i = 1, m.end()
        opener = re.compile(r"<(/?)%s\b" % re.escape(tag), re.I)
        while depth and i < len(body):
            nxt = opener.search(body, i)
            if not nxt:
                break
            depth += -1 if nxt.group(1) else 1
            i = nxt.end()
        end = body.index(">", i - 1) + 1 if depth == 0 else m.end()
        body = body[:m.start()] + body[end:]


def old_html_only(body):
    """Their editor accepts XHTML 1.0 / HTML 4.01 and may strip anything
       newer. Rather than hope each modern piece survives, none is sent.

       details/summary  kept. These are HTML5 and the guidance warns that
                        newer tags may be stripped, so the FAQ went out
                        unfolded at first -- an answer always showing is a
                        poor result, but a dropdown that cannot open is a
                        worse one. A probe page pasted into a scratch
                        article settled it: the element survives there,
                        triangle and all, so the folding comes back. If it
                        is ever stripped the children remain and the
                        answers simply show, which is where this started.
       srcset           one picture instead of three to choose from.
       data- and aria-  not in that DTD. data- in particular is load
                        bearing here -- the rules that hide a cleared
                        field key off it -- so rather than risk it being
                        dropped and every blank reappearing, the hidden
                        elements are removed outright. Nothing edits this
                        copy, so there is nothing for them to come back for.
    """
    body = cut_marked(body)

    # one picture, not a set
    body = re.sub(r'\s(?:srcset|sizes)="[^"]*"', "", body)

    # attributes that DTD never heard of
    body = re.sub(r'\s(?:data-[\w-]+|aria-[\w-]+|role)="[^"]*"', "", body)
    body = re.sub(r"\s(?:data-[\w-]+|aria-[\w-]+)(?=[\s/>])", "", body)
    return body


def static_map(body):
    """drawMap builds the frame from whatever address is typed. With no
       script, write the frame out directly."""
    def frame(m):
        where = re.sub(r"\s+", " ", m.group(1)).strip()
        q = where.replace("&", "and")
        return ('<iframe class="cf26-map" title="Map" loading="lazy" '
                'src="https://www.google.com/maps?q=%s&amp;output=embed" '
                'style="border:0;width:100%%;min-height:260px;display:block"></iframe>'
                % q.replace(" ", "+").replace(",", "%2C"))
    return re.sub(r'<div class="cf26-map" data-cf-map="[^"]*">(.*?)</div>',
                  frame, body, flags=re.S)


def retarget(body, me):
    """Pages point at each other through the CMS, not through the hosted
       copy.

       This used to match the page paths exactly, which quietly missed
       every link that carries a section with it. The header on the four
       application pages points at the main page AND a place on it --
       /Chanukah-Fest-26/#schedule and six more like it -- so none of
       them matched. They fell through to the catch-all below, came out
       as full github.io addresses, and tapping About on the sponsor
       page left the Chabad site altogether. The section is kept and
       carried onto the article link."""
    def swap(m):
        slug = (m.group(1) or "").strip("/") or "index"
        if slug not in AID:
            return m.group(0)          # not a page of ours; leave it alone
        return 'href="/article.asp?aid=%s%s"' % (AID[slug], m.group(2) or "")

    body = re.sub(r'href="/Chanukah-Fest-26/([a-z]*/?)(#[\w-]*)?"', swap, body)

    # Anything else still hosted -- images above all -- is reached in full.
    # Not every one is preceded by a quote: a srcset lists several, so the
    # path is matched wherever it appears and skipped where it is already
    # absolute.
    body = re.sub(r"(?<!github\.io)/Chanukah-Fest-26/", LIVE + "/", body)
    return body


def tidy_comments(doc):
    """XML forbids a double hyphen inside a comment, so prose that uses one
       as a dash takes the whole page down with it -- including, as it turned
       out, the note at the top of this very file."""
    def fix(m):
        inner = m.group(1)
        while "--" in inner:
            inner = inner.replace("--", "-")
        return "<!--" + inner + "-->"
    return re.sub(r"<!--(.*?)-->", fix, doc, flags=re.S)


XML_KNOWS = {"amp", "lt", "gt", "quot", "apos"}

TAG = re.compile(r"<[A-Za-z][^>]*>", re.S)
# name, then optionally = and a value
ATTR = re.compile(r"""(\s+)([A-Za-z_:][-\w:.]*)(\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?""")


def value_every_attribute(doc):
    """HTML lets an attribute stand alone -- novalidate, required, and the
       data- flags this site uses. XML wants a value on every one. Listing
       the names would only hold until the next one was added, so anything
       without a value gets its own name as the value, which is what HTML
       means by it anyway."""
    def in_tag(m):
        tag = m.group(0)
        head = re.match(r"<[A-Za-z][-\w:.]*", tag).group(0)
        rest = tag[len(head):]
        close = ""
        if rest.rstrip().endswith("/>"):
            rest, close = rest.rstrip()[:-2], " /"
        elif rest.rstrip().endswith(">"):
            rest, close = rest.rstrip()[:-1], ""
        rest = ATTR.sub(
            lambda a: a.group(1) + a.group(2) + (a.group(3) or '="%s"' % a.group(2)),
            rest)
        return head + rest + close + ">"
    return TAG.sub(in_tag, doc)


def numeric_entities(doc):
    """XML defines five entities by name and no more, so &mdash; is an
       undefined entity and stops the parse. The numbered form means the
       same thing and is always safe -- which is why the pages that are on
       the Chabad site already are written with &#160; rather than &nbsp;."""
    from html.entities import name2codepoint

    def fix(m):
        name = m.group(1)
        if name in XML_KNOWS:
            return m.group(0)
        cp = name2codepoint.get(name)
        return "&#%d;" % cp if cp else m.group(0)

    return re.sub(r"&([A-Za-z][A-Za-z0-9]*);", fix, doc)


def xml_safe(body):
    # a bare & stops their parser dead; leave real entities alone
    body = re.sub(r"&(?!#?\w+;)", "&amp;", body)
    body = numeric_entities(body)
    body = value_every_attribute(body)
    # every void tag closes itself
    for tag in VOID:
        body = re.sub(r"<(%s)\b([^>]*?)\s*/?>" % tag,
                      lambda m: "<%s%s />" % (m.group(1), m.group(2).rstrip()), body)
    return body


def header(slug, label):
    others = "\n".join(
        "       %-11s /article.asp?aid=%s" % (s.capitalize(), a)
        for s, a in AID.items())
    return ("""<!-- ===========================================================
     CHANUKAH FEST 2026 - %s
     Paste this whole block into the CMS page: aid=%s

     Links between the pages (search and replace if an aid changes):
%s

     Pictures are still served from the hosted copy:
       %s/images/...
     Upload them to the Chabad media library and replace that address
     if you would rather not depend on it.

     This block contains no JavaScript, so: the date chip does not open a
     calendar menu, there is no back-to-top button, and the menu on a
     phone is a strip that scrolls rather than a button. The FAQ
     dropdowns do work -- they need no script.
%s     =========================================================== -->
""" % (label, AID[slug], others, LIVE, WARNING.replace("SLUG", slug) if slug != "index" else ""))


def main():
    os.makedirs(OUT, exist_ok=True)
    nav_css = read("assets/nav.css")
    for slug, path, label in PAGES:
        html = read(path)
        body = one_stylesheet(html, body_of(html), nav_css)
        body = drop_script_only_bits(body)
        body = old_html_only(body)
        body = static_map(body)
        body = retarget(body, slug)
        body = xml_safe(body)

        out = tidy_comments(header(slug, label) + body) + "\n"
        name = "%s-aid-%s-BUILT-%s.html" % (label, AID[slug], BUILT)
        io.open(os.path.join(OUT, name), "w", encoding="utf-8").write(out)

        left = len(re.findall(r"(?<!github\.io)/Chanukah-Fest-26/", out))

        # Prove it, rather than trust the steps above: read it back the
        # way their system will.
        from xml.etree import ElementTree as ET
        try:
            ET.fromstring("<root>" + out + "</root>")
        except ET.ParseError as err:
            raise AssertionError("%s does not parse as XML: %s" % (name, err))

        # details and summary are deliberate now -- the probe page showed
        # their system keeps them -- so they are not on this list.
        # A link to the hosted copy walks the reader off the Chabad site
        # mid-visit. Pictures are served from there on purpose; an href
        # never should be, and this shipped once before it was noticed.
        for banned, what in [(r'href="[^"]*github\.io', "a link back to the hosted copy"),
                             (r"\ssrcset=", "srcset"),
                             (r"\sdata-[\w-]+=", "a data- attribute"),
                             (r"\saria-[\w-]+=", "an aria- attribute")]:
            hits = re.findall(banned, out)
            assert not hits, "%s still has %s (%d)" % (name, what, len(hits))

        # A bare < inside the stylesheet is markup to an XML parser, so a
        # CSS comment that mentions a tag would break the page.
        style = out[out.index("<style"):out.index("</style>")]
        stray = re.findall(r"<(?!/?style)", style)
        assert not stray, "%s: %d stray < inside the stylesheet" % (name, len(stray))

        # Their parser is XML: one unmatched tag and the whole page is
        # refused. Cheaper to notice here than in the CMS.
        for tag in ("div", "span", "p", "a", "ul", "li", "details", "summary"):
            opened = len(re.findall(r"<%s[\s>]" % tag, out))
            closed = len(re.findall(r"</%s>" % tag, out))
            assert opened == closed, "%s: <%s> %d open, %d closed" % (name, tag, opened, closed)
        print("  %-26s %6d bytes  scripts:%d  unresolved paths:%d  bare &:%d"
              % (name, len(out),
                 len(re.findall(r"<script", out)),
                 left,
                 len(re.findall(r"&(?!#?\w+;)", out))))


if __name__ == "__main__":
    main()
