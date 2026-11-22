/**
 * CHANUKAH FEST 2026 — RAFFLE
 *
 * Does three jobs:
 *   1. Receives entries from the Raffle page on the website.
 *   2. Serves the draw screen the list of people who can win.
 *   3. Records winners and emails them.
 *
 * EVERY PERSON IS A TICKET. The person who filled in the form, and each
 * family member they added, can each be drawn by name, and one family
 * can win more than once.
 *
 * Setup steps are in RAFFLE-SETUP-STEPS.txt
 */

// Bump this whenever you paste a new copy in, so you can tell at a
// glance which version Google is actually serving. Open the /exec URL
// in a browser and the version is printed on the page.
var VERSION = 'v25 — lists, codes and logins cached';

var SHEET_NAME = 'Entries';
var WINNERS_NAME = 'Winners';
var VENDOR_NAME = 'Vendors';
var SPONSOR_NAME = 'Sponsors';
var VOLUNTEER_NAME = 'Volunteers';
var CONTENT_NAME = 'Site text';

var HEADERS = [
  'Entered at', 'First name', 'Last name', 'Age', 'Phone', 'Email', 'Address',
  'Party size', 'Family members', 'Source',
  'Won', 'Won at', 'Prizes won', 'Emailed'
];

var C = {
  TIME: 1, FIRST: 2, LAST: 3, AGE: 4, PHONE: 5, EMAIL: 6, ADDRESS: 7,
  PARTY: 8, FAMILY: 9, SOURCE: 10,
  WON: 11, WON_AT: 12, PRIZE: 13, EMAILED: 14
};

var WIN_HEADERS = [
  'Prize', 'Winner', 'Age', 'Entered by', 'Phone', 'Email', 'Won at', 'Emailed', 'Ticket'
];

var W = {
  PRIZE: 1, WINNER: 2, AGE: 3, HOUSEHOLD: 4,
  PHONE: 5, EMAIL: 6, WON_AT: 7, EMAILED: 8, TICKET: 9
};

var MAX_FAMILY = 10;

var VENDOR_HEADERS = [
  'Submitted at', 'Business', 'Contact', 'Phone', 'Email', 'Website',
  'Tax ID / EIN', 'Address', 'City', 'State', 'ZIP',
  'Booth types', 'Booth total', 'Products or activities',
  'Staff', 'Returning?', 'Equipment', 'Power needs',
  'Kosher', 'Permits', 'Insurance', 'Payment method'
];

var VOLUNTEER_HEADERS = [
  'Submitted at', 'First name', 'Last name', 'Email', 'Phone',
  'T-shirt', 'Age group', 'Teams', 'Shifts',
  'Emergency contact', 'Emergency phone', 'Skills or experience'
];

var SPONSOR_HEADERS = [
  'Submitted at', 'Level', 'Custom amount', 'Organization',
  'Name for signage', 'Contact', 'Email', 'Phone',
  'Address', 'City', 'State', 'ZIP',
  'Payment method', 'Wants exclusivity', 'Notes'
];

// CHANGE THIS. It is the password for the draw screen, and anyone who
// has it can read every entrant's name, phone number and email, and can
// send winner emails from your Google account. Pick something nobody
// would guess from the words "Chanukah Fest 2026", then redeploy and
// enter the new key once on each computer that runs the draw.
var DRAW_KEY = '__DRAW_KEY__';

// Who the winner email comes from.
//
// Leave this as it is and the email arrives from whichever Google
// account deployed the script, which is probably a private address.
// To send from the festival address instead, add it to that Gmail
// account under Settings > Accounts and import > Send mail as, click
// the link in the confirmation email it sends, and this will start
// using it on its own. Raffle > Who sends the email tells you which
// address is in use.
var SEND_AS = 'yossi@chabadoutreach.org';

var DEFAULT_SUBJECT = 'You won a Chanukah Fest raffle prize';
var DEFAULT_MESSAGE =
  'Mazel tov!\n\n' +
  '{name} was just drawn for {prize} in the Chanukah Fest 2026 raffle ' +
  'at Houston City Hall.\n\n' +
  'Come to the information booth with this email to collect the prize.\n\n' +
  'Questions? Call 713-774-0300.';

/* ==================================================================
   1a. TELLING THE RIGHT PEOPLE
   Each form has its own inbox. Change an address here and nowhere
   else -- nothing below hard-codes one.
   ================================================================== */

var NOTIFY = {
  raffle:    'Registration@chabadoutreach.org',
  sponsor:   'sponsor@chabadoutreach.org',
  vendor:    'vendor@chabadoutreach.org',
  volunteer: 'volunteer@chabadoutreach.org'
};

/** Shown as the sender's name. The address itself is whichever account
    owns this script. */
var NOTIFY_FROM_NAME = 'Chanukah Fest website';

/**
 * Send one submission to the inbox that handles it.
 *
 * Reply-to is set to the person who filled the form in, so hitting
 * Reply in Gmail writes to them rather than back to the website.
 *
 * Nothing here is allowed to break a submission. By the time this runs
 * the row is already in the sheet and the person is about to see their
 * thank you. If the mail cannot go -- the day's quota is spent, an
 * address has a typo, Gmail is having a morning -- that must not cost
 * anyone their application. So it fails quietly and the sheet stays
 * the record of what came in. Mail is the convenience, not the copy.
 *
 * Blank fields are left out rather than sent as empty lines.
 */
function notify_(which, subject, lines, replyTo) {
  var to = NOTIFY[which];
  if (!to) return;
  try {
    var body = lines
      .filter(function (row) {
        return row && row[1] !== '' && row[1] !== null && row[1] !== undefined;
      })
      .map(function (row) { return row[0] + ': ' + row[1]; })
      .join('\n');

    var opts = { name: NOTIFY_FROM_NAME };
    if (replyTo && replyTo.indexOf('@') > 0) opts.replyTo = replyTo;

    GmailApp.sendEmail(to, subject,
      body + '\n\n--\nSent automatically by the Chanukah Fest website.', opts);
  } catch (err) {
    // Still must not break the submission -- but silence cost an
    // afternoon: a notification that never arrived looked identical to
    // one that was never attempted. This leaves a line in Executions
    // without the person who filled the form ever knowing.
    try {
      console.error('notify_ could not send to ' + to + ': ' +
                    (err && err.message || err));
    } catch (ignored) {}
  }
}


/**
 * Run this from the editor to find out whether sending works at all.
 *
 * notify_ swallows its errors by design, so a failure there is invisible.
 * This one does not: if the account cannot send, or has never been given
 * permission to, you will see it here as a red error rather than as an
 * email that quietly never arrives.
 */
function testNotify() {
  var to = NOTIFY.vendor;
  GmailApp.sendEmail(to, 'Test from the Chanukah Fest website',
    'If this arrived, notifications work and the address is right.\n\n' +
    'Daily sends left on this account: ' + MailApp.getRemainingDailyQuota());
  return 'sent to ' + to;
}

/* ==================================================================
   1. RECEIVING ENTRIES FROM THE WEBSITE
   ================================================================== */

function doPost(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var many = (e && e.parameters) ? e.parameters : {};

  // One endpoint, three forms. Anything without a form field is a
  // raffle entry, which is how the raffle page has always posted.
  // Saving site wording is the one POST that needs the key, because it
  // changes what the public sees.
  if (trim_(p.action) === 'savecontent') return saveSiteContent_(p);

  if (trim_(p.form) === 'vendor')    return saveVendor_(p, many);
  if (trim_(p.form) === 'sponsor')   return saveSponsor_(p);
  if (trim_(p.form) === 'volunteer') return saveVolunteer_(p, many);
  return saveRaffleEntry_(p);
}

function saveRaffleEntry_(p) {
  try {
    // Honeypot: real people never fill this in. Bots do.
    if (p.company) return thankYouPage_(fullName_(p.first, p.last), []);

    var first = trim_(p.first);
    var last = trim_(p.last);
    var phone = trim_(p.phone);
    var email = trim_(p.email);
    var name = fullName_(first, last);

    if (!first || !last || !phone || !email) {
      return messagePage(
        'Something was missing',
        'We need your first name, last name, mobile number and email to enter you. ' +
        'Go back and fill them all in.'
      );
    }

    // Never turn anyone away over a half-typed family name. Whatever
    // they gave us is recorded, and we have the household's phone and
    // email either way.
    var family = collectFamily_(p);
    var sheet = getSheet_();
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);

    var merged = null;
    try {
      // Already here? Add anyone new rather than refusing the whole lot.
      var row = findHousehold_(sheet, phone, email);
      if (row) {
        merged = addToHousehold_(sheet, row, name, family);
      } else {
      sheet.appendRow([
        new Date(), first, last, digits_(p.age), phone, email, trim_(p.address),
        1 + family.length, describeFamily_(family), trim_(p.source),
        '', '', '', ''
      ]);
      }
    } finally {
      lock.releaseLock();
    }

    // An addition is not a new registration, so it does not notify.
    if (merged) return merged;

    notify_('raffle', 'Raffle entry: ' + name, [
      ['Name', name],
      ['Age', digits_(p.age)],
      ['Phone', phone],
      ['Email', email],
      ['Address', trim_(p.address)],
      ['Party size', 1 + family.length],
      ['Family', describeFamily_(family)],
      ['Heard about it', trim_(p.source)]
    ], email);

    return thankYouPage_(name, family);

  } catch (err) {
    return messagePage(
      "That didn't go through",
      'Something went wrong on our end. Please try again, or enter at the information booth.'
    );
  }
}

/* ==================================================================
   1b. VENDOR AND SPONSOR APPLICATIONS
   Same endpoint, separate tabs. Neither one is a raffle entry, so
   neither touches the Entries sheet or the draw.
   ================================================================== */

function saveVendor_(p, many) {
  try {
    if (p.company) return simpleThanks_('Application received');

    var business = trim_(p.business_name);
    var email = trim_(p.email);
    if (!business || !email) {
      return messagePage('Something was missing',
        'We need at least the business name and an email address. Go back and add them.');
    }

    var booths = list_(many, 'booth_type[]');
    var sheet = tabWithHeaders_(VENDOR_NAME, VENDOR_HEADERS, '#1B6FA8');
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      sheet.appendRow([
        new Date(), business,
        fullName_(p.contact_first, p.contact_last),
        trim_(p.phone), email, trim_(p.website), trim_(p.tax_id),
        trim_(p.address), trim_(p.city), trim_(p.state), trim_(p.zip),
        booths.join('; '), boothTotal_(booths),
        trim_(p.products_description), trim_(p.staff_count), trim_(p.returning_vendor),
        list_(many, 'equipment[]').join('; '), trim_(p.power_needs),
        yesNo_(p.agree_kosher), yesNo_(p.agree_permits), yesNo_(p.agree_coi),
        trim_(p.payment_method)
      ]);
    } finally {
      lock.releaseLock();
    }

    notify_('vendor', 'Booth application: ' + business, [
      ['Business', business],
      ['Contact', fullName_(p.contact_first, p.contact_last)],
      ['Phone', trim_(p.phone)],
      ['Email', email],
      ['Website', trim_(p.website)],
      ['Booths', booths.join('; ')],
      ['Total', boothTotal_(booths)],
      ['Selling or doing', trim_(p.products_description)],
      ['Staff', trim_(p.staff_count)],
      ['Returning vendor', trim_(p.returning_vendor)],
      ['Equipment', list_(many, 'equipment[]').join('; ')],
      ['Power needed', trim_(p.power_needs)],
      ['Payment method', trim_(p.payment_method)]
    ], email);

    return simpleThanks_('Application received');

  } catch (err) {
    return messagePage("That didn't go through",
      'Something went wrong on our end. Please try again, or call 713-774-0300.');
  }
}

function saveVolunteer_(p, many) {
  try {
    if (p.company) return simpleThanks_('Thank you');

    var first = trim_(p.first);
    var last = trim_(p.last);
    var email = trim_(p.email);
    if (!first || !last || !email) {
      return messagePage('Something was missing',
        'We need your name and an email address. Go back and add them.');
    }

    var sheet = tabWithHeaders_(VOLUNTEER_NAME, VOLUNTEER_HEADERS, '#3EE8B5', '#05231A');
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      sheet.appendRow([
        new Date(), first, last, email, trim_(p.phone),
        trim_(p.tshirt), trim_(p.age_group),
        list_(many, 'teams[]').join('; '),
        list_(many, 'shifts[]').join('; '),
        trim_(p.emergency_name), trim_(p.emergency_phone),
        trim_(p.skills)
      ]);
    } finally {
      lock.releaseLock();
    }

    notify_('volunteer', 'Volunteer: ' + fullName_(first, last), [
      ['Name', fullName_(first, last)],
      ['Email', email],
      ['Phone', trim_(p.phone)],
      ['T-shirt', trim_(p.tshirt)],
      ['Age group', trim_(p.age_group)],
      ['Teams', list_(many, 'teams[]').join('; ')],
      ['Shifts', list_(many, 'shifts[]').join('; ')],
      ['Emergency contact', trim_(p.emergency_name)],
      ['Emergency phone', trim_(p.emergency_phone)],
      ['Skills', trim_(p.skills)]
    ], email);

    return simpleThanks_('Thank you');

  } catch (err) {
    return messagePage("That didn't go through",
      'Something went wrong on our end. Please try again, or call 713-774-0300.');
  }
}

function saveSponsor_(p) {
  try {
    if (p.company) return simpleThanks_('Thank you');

    var org = trim_(p.organization);
    var email = trim_(p.email);
    if (!org || !email) {
      return messagePage('Something was missing',
        'We need at least the organization name and an email address. Go back and add them.');
    }

    var sheet = tabWithHeaders_(SPONSOR_NAME, SPONSOR_HEADERS, '#F0B429', '#16202E');
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      sheet.appendRow([
        new Date(), trim_(p.sponsorship_level), trim_(p.custom_amount),
        org, trim_(p.signage_name),
        fullName_(p.contact_first, p.contact_last),
        email, trim_(p.phone),
        trim_(p.address), trim_(p.city), trim_(p.state), trim_(p.zip),
        trim_(p.payment_method), yesNo_(p.exclusivity_requested), trim_(p.notes)
      ]);
    } finally {
      lock.releaseLock();
    }

    notify_('sponsor', 'Sponsorship: ' + org, [
      ['Organization', org],
      ['Level', trim_(p.sponsorship_level)],
      ['Custom amount', trim_(p.custom_amount)],
      ['Name for signage', trim_(p.signage_name)],
      ['Contact', fullName_(p.contact_first, p.contact_last)],
      ['Email', email],
      ['Phone', trim_(p.phone)],
      ['Payment method', trim_(p.payment_method)],
      ['Exclusivity requested', yesNo_(p.exclusivity_requested)],
      ['Notes', trim_(p.notes)]
    ], email);

    return simpleThanks_('Thank you');

  } catch (err) {
    return messagePage("That didn't go through",
      'Something went wrong on our end. Please try again, or call 713-774-0300.');
  }
}

/** Checkbox groups arrive as arrays; everything else as one value. */
function list_(many, key) {
  var v = many[key];
  if (!v) return [];
  if (Object.prototype.toString.call(v) !== '[object Array]') v = [v];
  var out = [];
  for (var i = 0; i < v.length; i++) {
    var s = trim_(v[i]);
    if (s) out.push(s);
  }
  return out;
}

/** "Food Vendor - $1,500" -> 1500, summed. */
function boothTotal_(booths) {
  var sum = 0;
  for (var i = 0; i < booths.length; i++) {
    var m = /\$\s*([\d,]+)/.exec(booths[i]);
    if (m) sum += parseInt(m[1].replace(/,/g, ''), 10) || 0;
  }
  return sum || '';
}

function yesNo_(v) { return trim_(v) ? 'Yes' : ''; }

function tabWithHeaders_(name, headers, bg, fg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() <= 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground(bg || '#0A1E38')
      .setFontColor(fg || '#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** The forms post into a hidden frame, so nobody sees this. It exists
    so the browser gets a valid reply instead of an error. */
function simpleThanks_(heading) {
  return page_('', heading, 'We have your details and will be in touch.');
}

/* ==================================================================
   2. WHAT THE DRAW SCREEN ASKS FOR
   ================================================================== */

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};

  // The site itself reads this on every page load, so it carries no key
  // and gives away nothing: it is the wording already printed on the
  // public pages.
  if (p.action === 'content') {
    var body;
    try { body = siteContent_(); }
    catch (err) { body = { ok: false, error: String(err && err.message || err) }; }
    var json = JSON.stringify(body);
    if (p.callback) {
      return ContentService.createTextOutput(p.callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  // The gate. Its own key, checked against the staff tab, so a
  // volunteer's phone never carries the draw key around a festival.
  if (p.action === 'roster' || p.action === 'checkin') {
    var out;
    try {
      var staff = findStaff_(p.key);
      if (!staff) {
        out = { ok: false, status: 'badcode' };
      } else if (p.action === 'roster') {
        out = rosterForScanner_(staff);
      } else {
        out = checkIn_(staff, p.t, p.how, p.who);
      }
    } catch (err) {
      out = { ok: false, status: 'error', error: String(err && err.message || err) };
    }
    var body = JSON.stringify(out);
    if (p.callback) {
      return ContentService.createTextOutput(p.callback + '(' + body + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(body)
      .setMimeType(ContentService.MimeType.JSON);
  }

  // The admin page. Its own key -- a name and password checked
  // against the Admins tab -- so nothing here rides on the draw key
  // or a volunteer's gate code.
  if (p.action && p.action.indexOf('admin') === 0) {
    var ao;
    try {
      var me = findAdmin_(p.user, p.pass);
      if (!me) {
        ao = { ok: false, status: 'badlogin' };
      } else if (p.action === 'adminLogin')        ao = { ok: true, name: me.name };
      else if (p.action === 'adminPeople')         ao = adminPeople_();
      else if (p.action === 'adminResend')         ao = adminResend_(me, p.t);
      else if (p.action === 'adminUndo')           ao = adminUndoCheckIn_(me, p.t, p.who);
      else if (p.action === 'adminParty')          ao = adminSetParty_(me, p.t, p.n);
      else if (p.action === 'adminStaff')          ao = adminStaff_();
      else if (p.action === 'adminStaffAdd')       ao = adminAddStaff_(me, p.n);
      else if (p.action === 'adminStaffRemove')    ao = adminRemoveStaff_(me, p.c);
      else if (p.action === 'adminAdmins')         ao = adminList_();
      else if (p.action === 'adminAdminAdd')       ao = adminAddAdmin_(me, p.n, p.pw);
      else if (p.action === 'adminAdminRemove')    ao = adminRemoveAdmin_(me, p.n);
      else ao = { ok: false, error: 'Not something this page can do.' };
    } catch (err) {
      ao = { ok: false, error: String(err && err.message || err) };
    }
    var ab = JSON.stringify(ao);
    if (p.callback) {
      return ContentService.createTextOutput(p.callback + '(' + ab + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(ab).setMimeType(ContentService.MimeType.JSON);
  }

  if (p.callback && p.key === DRAW_KEY) {
    var payload;
    try {
      if (p.action === 'won')       payload = markWinner_(p);
      else if (p.action === 'test') payload = testEmail_(p);
      else                          payload = ticketsForDraw_();
    } catch (err) {
      payload = { ok: false, error: String(err && err.message || err) };
    }
    return ContentService
      .createTextOutput(p.callback + '(' + JSON.stringify(payload) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return messagePage(
    'Chanukah Fest Raffle',
    'Scan the QR code at the festival, or visit the raffle page to enter.' +
    '<br><br><span style="font-size:14px;opacity:.65">Script ' + VERSION + '</span>'
  );
}

/**
 * One ticket per PERSON. Ticket id is "<row>-<index>", where index 0 is
 * whoever filled in the form and 1 upwards are the family members in the
 * order they typed them.
 * Only names leave the sheet. No phone numbers, no email addresses.
 */
/** The tab the draw reads, and how wide its rows are. */
function drawSource_() {
  return (DRAW_READS === 'Registrations')
    ? { sheet: getRegSheet_(), width: REG_HEADERS.length, isReg: true }
    : { sheet: getSheet_(),    width: HEADERS.length,     isReg: false };
}

/** Everyone on one row, whichever tab it came from. */
function peopleOnRow_(row, isReg) {
  return isReg ? peopleOnRegistration_(row) : peopleOnEntry_(row);
}

/** The old website form: the person, then the family they typed in. */
function peopleOnEntry_(row) {
  var household = fullName_(row[C.FIRST - 1], row[C.LAST - 1]);
  var seen = {}, people = [];

  if (household) {
    people.push({ name: household, age: trim_(row[C.AGE - 1]) });
    seen[household.toLowerCase()] = true;
  }

  var members = parseFamily_(row[C.FAMILY - 1]) || [];
  for (var i = 0; i < members.length; i++) {
    var n = trim_(members[i].name);
    if (!n) continue;
    var key = n.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    people.push({ name: n, age: members[i].age || '' });
  }
  return people;
}

function ticketsForDraw_() {
  var src = drawSource_();
  var sheet = src.sheet;
  var last = sheet.getLastRow();
  var tickets = [];

  if (last >= 2) {
    var rows = sheet.getRange(2, 1, last - 1, src.width).getValues();
    for (var i = 0; i < rows.length; i++) {
      var row = i + 2;
      var household = src.isReg
        ? fullName_(rows[i][R.FIRST - 1], rows[i][R.LAST - 1])
        : fullName_(rows[i][C.FIRST - 1], rows[i][C.LAST - 1]);
      if (!household) continue;

      var people = peopleOnRow_(rows[i], src.isReg);
      for (var k = 0; k < people.length; k++) {
        tickets.push({
          id: row + '-' + k,
          name: people[k].name,
          household: household,
          age: people[k].age || ''
        });
      }
    }
  }

  return { ok: true, tickets: tickets, count: tickets.length,
           source: DRAW_READS, winners: winnersSoFar_() };
}

/**
 * Everyone on one registration, as a list.
 *
 * The person who booked is first. After them come whichever guests
 * Chabad's confirmation actually named -- and their form does not
 * name all of them, so the rest are made up to the headcount as
 * numbered guests of that household.
 *
 * That matters for fairness. A family of five registered as five
 * people should have five chances, not two because their email only
 * printed two names. And if a numbered one wins, the household is
 * right there on the ticket to call.
 */
function peopleOnRegistration_(row) {
  var household = fullName_(row[R.FIRST - 1], row[R.LAST - 1]);
  var party = parseInt(row[R.PARTY - 1], 10) || 1;
  var named = parseFamily_(row[R.GUESTS - 1]) || [];

  // Their form has the person booking enter themselves as family
  // member 1, so the household name comes back in the guest list as
  // well. Counted twice they would be admitted twice at the gate and
  // hold two raffle tickets, which is one more than their share.
  var seen = {};
  var people = [];

  if (household) {
    people.push({ name: household, age: '' });
    seen[household.toLowerCase()] = true;
  }

  for (var i = 0; i < named.length && people.length < party; i++) {
    var n = trim_(named[i].name);
    if (!n) continue;
    var key = n.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    people.push({ name: n, age: named[i].age || '' });
  }

  while (people.length < party) {
    people.push({ name: household + ' \u2014 guest ' + people.length, age: '' });
  }
  return people;
}

/** Everything already drawn, so the board can be rebuilt on any laptop. */
function winnersSoFar_() {
  var ws = getWinnersSheet_();
  var last = ws.getLastRow();
  if (last < 2) return [];

  var rows = ws.getRange(2, 1, last - 1, WIN_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var who = trim_(rows[i][W.WINNER - 1]);
    if (!who) continue;
    out.push({
      prize: parseInt(rows[i][W.PRIZE - 1], 10) || 0,
      name: who,
      household: trim_(rows[i][W.HOUSEHOLD - 1]),
      id: trim_(rows[i][W.TICKET - 1]),
      wonAt: rows[i][W.WON_AT - 1] ? new Date(rows[i][W.WON_AT - 1]).getTime() : 0
    });
  }
  return out;
}

/** Records one winner and emails the household. */
function markWinner___raw(p) {
  var ticket = trim_(p.ticket);
  var bits = ticket.split('-');
  var row = parseInt(bits[0], 10);
  var idx = parseInt(bits[1], 10);
  var prizeNum = parseInt(p.prize, 10) || 0;

  var src = drawSource_();
  var sheet = src.sheet;
  if (!row || row < 2 || row > sheet.getLastRow() || isNaN(idx)) {
    return { ok: false, error: 'That ticket does not exist.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var ws = getWinnersSheet_();

    // Never record the same person twice.
    var already = winnersSoFar_();
    for (var i = 0; i < already.length; i++) {
      if (already[i].id === ticket) {
        return { ok: false, error: 'That person has already won.', duplicate: true };
      }
    }

    var entry = sheet.getRange(row, 1, 1, src.width).getValues()[0];
    var household = src.isReg
      ? fullName_(entry[R.FIRST - 1], entry[R.LAST - 1])
      : fullName_(entry[C.FIRST - 1], entry[C.LAST - 1]);
    var phone = trim_(entry[src.isReg ? R.PHONE - 1 : C.PHONE - 1]);
    var email = trim_(entry[src.isReg ? R.EMAIL - 1 : C.EMAIL - 1]);

    var people = peopleOnRow_(entry, src.isReg);
    if (!people[idx]) return { ok: false, error: 'That person is not on the registration.' };
    var who = people[idx].name;
    var age = people[idx].age;

    var prizeLabel = 'Prize ' + prizeNum;
    var emailed, note = '';

    if (!email) {
      emailed = 'No email on file';
    } else {
      try {
        sendWinnerEmail_(who, email, prizeLabel, p.subject, p.message, household);
        emailed = 'Sent ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'h:mm a');
      } catch (err) {
        note = String(err && err.message || err);
        emailed = 'FAILED: ' + note;
      }
    }

    ws.appendRow([prizeNum, who, age, household, phone, email, new Date(), emailed, ticket]);

    // Mark the entry row so the sheet is readable at a glance.
    var prior = trim_(entry[C.PRIZE - 1]);
    sheet.getRange(row, C.WON).setValue('Yes');
    sheet.getRange(row, C.WON_AT).setValue(new Date());
    sheet.getRange(row, C.PRIZE).setValue(prior ? prior + ', ' + prizeNum : String(prizeNum));
    sheet.getRange(row, C.EMAILED).setValue(emailed);
    sheet.getRange(row, 1, 1, HEADERS.length).setBackground('#FFF3D6');

    return {
      ok: true, name: who, household: household,
      emailed: emailed.indexOf('Sent') === 0,
      note: note || (email ? '' : 'No email address on this entry.')
    };

  } finally {
    lock.releaseLock();
  }
}

function testEmail_(p) {
  var to = trim_(p.to);
  if (!to) return { ok: false, error: 'No address given.' };
  try {
    sendWinnerEmail_(trim_(p.name) || 'Test Winner', to, trim_(p.prize) || 'Prize 1',
                     p.subject, p.message, trim_(p.name) || 'Test Winner');
    return { ok: true, emailed: true, to: to, remaining: MailApp.getRemainingDailyQuota() };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

/* ==================================================================
   3. DRAWING FROM INSIDE THE SHEET
   ================================================================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Raffle')
    .addItem('Draw a winner', 'drawWinner')
    .addItem('How many entries?', 'showCounts')
    .addItem('Emails left today', 'showEmailQuota')
    .addItem('Who sends the email', 'showSender')
    .addSeparator()
    .addItem('Clear all winners (testing only)', 'clearWinners')
    .addToUi();

  SpreadsheetApp.getUi()
    .createMenu('Door')
    .addItem('Add someone to the gate', 'addCheckInVolunteer')
    .addItem('Send myself a test pass', 'sendMyselfATestPass')
    .addItem('Send someone their pass again', 'sendSomeonesPassAgain')
    .addSeparator()
    .addItem('Set up the office admin logins', 'setUpOfficeAdmins')
    .addItem('Create a single admin login', 'createTheFirstAdmin')
    .addSeparator()
    .addItem('Read new registrations now', 'readRegistrationsNow')
    .addItem('Re-read every email (RE-SENDS passes)', 'readEverythingAgain')
    .addItem('Tidy the guest names', 'tidyGuestNames')
    .addSeparator()
    .addItem('Bring over the old website entries', 'bringOverOldEntries')
    .addSeparator()
    .addItem('Clear test registrations and ignore old emails', 'startTestingOver')
    .addItem('Why is nothing happening?', 'checkTheWiring')
    .addItem('Start reading registrations automatically', 'startRegistrationIntake')
    .addToUi();
}

function drawWinner() {
  var ui = SpreadsheetApp.getUi();
  var data = ticketsForDraw_();
  var won = {};
  data.winners.forEach(function (w) { won[w.id] = true; });

  var eligible = data.tickets.filter(function (t) { return !won[t.id]; });
  if (!eligible.length) {
    ui.alert('Nobody left', 'Every person has already won, or there are no entries yet.', ui.ButtonSet.OK);
    return;
  }

  var nextPrize = data.winners.length + 1;
  var prompt = ui.prompt('Draw a winner',
    eligible.length + ' people are still eligible.\n\nPrize number?',
    ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var num = parseInt(prompt.getResponseText(), 10) || nextPrize;
  var pick = eligible[Math.floor(Math.random() * eligible.length)];
  var r = markWinner_({ ticket: pick.id, prize: num });

  if (!r.ok) { ui.alert('Could not draw', r.error, ui.ButtonSet.OK); return; }

  ui.alert('WINNER',
    r.name + (r.name !== r.household ? '\n(entered by ' + r.household + ')' : '') +
    '\n\nPrize ' + num +
    '\nEmail: ' + (r.emailed ? 'sent' : 'not sent' + (r.note ? ' — ' + r.note : '')) +
    '\n\n' + (eligible.length - 1) + ' people still eligible.',
    ui.ButtonSet.OK);
}

function showCounts() {
  var data = ticketsForDraw_();
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  var households = 0;
  if (last >= 2) {
    sheet.getRange(2, C.FIRST, last - 1, 2).getValues().forEach(function (r) {
      if (fullName_(r[0], r[1])) households++;
    });
  }
  SpreadsheetApp.getUi().alert('Raffle entries',
    households + ' entries\n' + data.tickets.length + ' people in the draw\n\n' +
    data.winners.length + ' have won\n' +
    (data.tickets.length - data.winners.length) + ' still eligible',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function clearWinners() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Clear all winners?',
      'Empties the Winners tab and clears the Won columns on every entry. ' +
      'The entries themselves stay. Use this to reset after a test run.',
      ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last > 1) {
    sheet.getRange(2, C.WON, last - 1, 4).clearContent();
    sheet.getRange(2, 1, last - 1, HEADERS.length).setBackground(null);
  }

  var ws = getWinnersSheet_();
  if (ws.getLastRow() > 1) ws.deleteRows(2, ws.getLastRow() - 1);

  ui.alert('Done', 'All winners cleared.', ui.ButtonSet.OK);
}

function showSender() {
  var ui = SpreadsheetApp.getUi();
  var me = Session.getEffectiveUser().getEmail();
  var aliases = [];
  try { aliases = GmailApp.getAliases(); } catch (e) {}

  if (senderIsVerified_()) {
    ui.alert('Who sends the email',
      'Winners will see it come from:\n\n    ' + SEND_AS +
      '\n\nThat address is verified on this account.',
      ui.ButtonSet.OK);
    return;
  }

  ui.alert('Who sends the email',
    'Winners will see it come from:\n\n    ' + me +
    '\n\nTo send from ' + SEND_AS + ' instead, open Gmail on this ' +
    'account, go to Settings > Accounts and import > Send mail as > ' +
    'Add another email address, add it, and click the link in the ' +
    'confirmation email. Nothing here needs changing afterwards.' +
    (aliases.length
      ? '\n\nAddresses already set up here: ' + aliases.join(', ')
      : '\n\nThis account has no other send addresses set up yet.'),
    ui.ButtonSet.OK);
}

function showEmailQuota() {
  SpreadsheetApp.getUi().alert('Email quota',
    MailApp.getRemainingDailyQuota() + ' emails left today.\n\n' +
    'Free Gmail accounts get 100 a day. Google Workspace accounts get 1,500.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ==================================================================
   HELPERS
   ================================================================== */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  // Write the headers on a brand new sheet, and repair them on an empty
  // one left over from an older version of this script.
  if (sheet.getLastRow() <= 1) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#0A1E38').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getWinnersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(WINNERS_NAME) || ss.insertSheet(WINNERS_NAME);
  if (ws.getLastRow() === 0) {
    ws.appendRow(WIN_HEADERS);
    ws.getRange(1, 1, 1, WIN_HEADERS.length)
      .setFontWeight('bold').setBackground('#F0B429').setFontColor('#16202E');
    ws.setFrozenRows(1);
  }
  return ws;
}

function trim_(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }
function digits_(v) { return trim_(v).replace(/\D/g, ''); }

function fullName_(first, last) {
  return (trim_(first) + ' ' + trim_(last)).trim();
}

function collectFamily_(p) {
  var out = [];
  for (var i = 1; i <= MAX_FAMILY; i++) {
    var n = fullName_(p['fam' + i + '_first'], p['fam' + i + '_last']);
    if (!n) continue;
    out.push({ name: n, age: digits_(p['fam' + i + '_age']) });
  }
  return out;
}

/** "Jack (4); Mia (7); Avi" */
function describeFamily_(family) {
  return family.map(function (m) {
    return m.age ? m.name + ' (' + m.age + ')' : m.name;
  }).join('; ');
}

/** Reads that string back into people. */
function parseFamily_(text) {
  var out = [];
  trim_(text).split(';').forEach(function (part) {
    var s = trim_(part);
    if (!s) return;
    var m = /^(.*?)\s*\((\d+)\)\s*$/.exec(s);
    if (m) out.push({ name: trim_(m[1]), age: m[2] });
    else out.push({ name: s, age: '' });
  });
  return out.filter(function (m) { return m.name; });
}

/**
 * The row this household is already on, or 0 for nobody.
 *
 * The same test as before -- the phone or the email, whichever matches
 * -- but it hands back where they are rather than merely that they
 * exist. Knowing the row is what lets a second attempt add to an entry
 * instead of being turned away from it.
 */
function findHousehold_(sheet, phone, email) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var rows = sheet.getRange(2, C.PHONE, last - 1, 2).getValues();  // Phone, Email
  var newPhone = digits_(phone).slice(-10);
  var newEmail = trim_(email).toLowerCase();
  for (var i = 0; i < rows.length; i++) {
    var p = digits_(rows[i][0]).slice(-10);
    var m = trim_(rows[i][1]).toLowerCase();
    if (newPhone && p && p === newPhone) return i + 2;
    if (newEmail && m && m === newEmail) return i + 2;
  }
  return 0;
}

function isDuplicate_(sheet, phone, email) {
  return findHousehold_(sheet, phone, email) > 0;
}


/**
 * Add whoever is new to a household that is already on the list.
 *
 * Somebody registers, realises they left the children off, and fills
 * the form in again with the whole family. The second attempt matched
 * the first on phone and email and was refused -- correct as far as it
 * went, except that the children it carried were thrown away and the
 * page told them they were already entered. They were not. Only the
 * adult was, and there was no way for anyone to tell.
 *
 * So a repeat from a household already on the list adds the people in
 * it who are not on it yet, and says who they are. Names are compared
 * without regard to case, and an age fills a blank one rather than
 * overwriting an age already recorded. Nobody is ever added twice.
 *
 * A repeat carrying nobody new still says they are already in -- but
 * now it lists who is actually on the entry, read from the sheet,
 * rather than echoing back whatever was just typed.
 */
function addToHousehold_(sheet, row, name, family) {
  var span = sheet.getRange(row, C.FIRST, 1, C.FAMILY - C.FIRST + 1).getValues()[0];
  var mainName = fullName_(span[0], span[1]);                 // First, Last
  var listed = parseFamily_(span[C.FAMILY - C.FIRST]);

  function key(v) { return trim_(v).toLowerCase(); }
  var seen = {};
  seen[key(mainName)] = true;
  listed.forEach(function (m) { seen[key(m.name)] = true; });

  // what this submission carries: its family, and the person filling
  // it in if that happens to be somebody new to the household
  var offered = (family || []).slice();
  if (name && !seen[key(name)]) offered.unshift({ name: name, age: '' });

  var added = [];
  var changed = false;
  offered.forEach(function (m) {
    if (!m.name) return;
    if (seen[key(m.name)]) {
      if (m.age) {                        // an age for somebody already listed
        listed.forEach(function (had) {
          if (key(had.name) === key(m.name) && !had.age) {
            had.age = m.age;
            changed = true;
          }
        });
      }
      return;
    }
    seen[key(m.name)] = true;
    listed.push({ name: m.name, age: m.age || '' });
    added.push(m.name);
    changed = true;
  });

  // An age filled in on its own is still worth keeping, so the write
  // happens whenever anything moved -- not only when somebody is new.
  if (changed) {
    sheet.getRange(row, C.PARTY).setValue(1 + listed.length);
    sheet.getRange(row, C.FAMILY).setValue(describeFamily_(listed));
  }

  if (!added.length) return alreadyInPage_(mainName, listed);

  return page_('ADDED', 'Added to your entry',
    (added.length === 1
      ? added[0] + ' has been added to your entry.'
      : added.join(', ') + ' have been added to your entry.') +
    ' Everyone below is entered, each with their own chance to win.',
    namesOnEntry_(mainName, listed));
}

/* ==================================================================
   THE WINNER EMAIL
   ================================================================== */

function sendWinnerEmail_(name, email, prize, subjectOverride, messageOverride, household) {
  var firstName = String(name).trim().split(/\s+/)[0];

  var subject = trim_(subjectOverride) || DEFAULT_SUBJECT;
  var plain = (trim_(messageOverride) || DEFAULT_MESSAGE)
    .split('{name}').join(name)
    .split('{firstname}').join(firstName)
    .split('{household}').join(household || name)
    .split('{prize}').join(prize || 'a prize');

  var paragraphs = plain.split(/\n\s*\n/).map(function (para) {
    return '<p style="margin:0 0 14px">' + escape_(para).split('\n').join('<br>') + '</p>';
  }).join('');

  var html =
  '<div style="background:#0A1E38;padding:32px 20px;font-family:Helvetica,Arial,sans-serif">' +
    '<div style="max-width:460px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">' +
      '<div style="background:#0A1E38;padding:30px 24px;text-align:center">' +
        '<div style="display:inline-block;background:#F0B429;color:#16202E;font-size:12px;' +
        'font-weight:bold;letter-spacing:1px;padding:7px 16px;border-radius:999px">YOU WON</div>' +
        '<h1 style="color:#fff;font-size:28px;line-height:1.1;margin:18px 0 0">Mazel tov, ' +
        escape_(firstName) + '</h1>' +
      '</div>' +
      '<div style="padding:26px 24px;color:#16202E;font-size:16px;line-height:1.6">' + paragraphs + '</div>' +
      '<div style="background:#F4F6F9;padding:16px 24px;color:#6B7C90;font-size:12.5px;text-align:center">' +
        'Chabad Outreach of Houston &middot; 11000 Fondren Rd, Ste B-104, Houston, TX 77096' +
      '</div>' +
    '</div>' +
  '</div>';

  var opts = {
    to: email, subject: subject, body: plain, htmlBody: html,
    name: 'Chanukah Fest 2026', replyTo: SEND_AS
  };

  // Gmail will only send from an address this account has verified, so
  // ask it rather than assume. Unverified, it would throw and the
  // winner would get nothing, which is worse than the wrong sender.
  if (senderIsVerified_()) {
    opts.from = SEND_AS;
    GmailApp.sendEmail(email, subject, plain, opts);
  } else {
    MailApp.sendEmail(opts);
  }
}

/** Is SEND_AS set up as a Send mail as address on this account? */
function senderIsVerified_() {
  if (!SEND_AS) return false;
  var want = SEND_AS.toLowerCase();
  try {
    // The account's own address needs no setting up: mail already comes
    // from it. getAliases lists the extra addresses added to an account,
    // never the account itself, so without this the menu would tell you
    // to go and verify the address you are already sending from.
    var me = Session.getEffectiveUser().getEmail();
    if (me && me.toLowerCase() === want) return true;
  } catch (e) {}
  try {
    var aliases = GmailApp.getAliases();
    for (var i = 0; i < aliases.length; i++) {
      if (String(aliases[i]).toLowerCase() === want) return true;
    }
  } catch (e) {}
  return false;
}

function escape_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ==================================================================
   PAGES THE ENTRANT SEES
   ================================================================== */

function page_(badge, heading, body, people) {
  var list = '';
  if (people && people.length) {
    list = '<div style="background:#F4F6F9;border-radius:10px;padding:18px 20px;margin-top:22px;text-align:left">' +
      '<div style="font-size:12.5px;font-weight:800;color:#8A6A1E;letter-spacing:.03em;margin-bottom:10px">' +
      (people.length === 1 ? 'ENTERED' : people.length + ' PEOPLE ENTERED') + '</div>';
    for (var i = 0; i < people.length; i++) {
      list += '<div style="font-size:16px;font-weight:600;color:#0A1E38;padding:5px 0;' +
        (i ? 'border-top:1px solid #E3E9F0;' : '') + '">' + escape_(people[i]) + '</div>';
    }
    list += '</div>';
  }

  var html =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Chanukah Fest Raffle</title>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Newsreader:opsz,wght@6..72,400&display=swap">' +
  '<style>' +
  '*{box-sizing:border-box;margin:0;padding:0}' +
  'body{background:#0A1E38;color:#fff;min-height:100vh;display:flex;align-items:center;' +
  'justify-content:center;padding:28px 20px;text-align:center;' +
  'background-image:radial-gradient(620px 320px at 50% 115%,rgba(240,180,41,.26) 0%,rgba(240,180,41,0) 70%);' +
  'font-family:"Bricolage Grotesque","Helvetica Neue",Arial,sans-serif}' +
  '.w{max-width:460px;width:100%}' +
  '.b{display:inline-block;background:#F0B429;color:#16202E;font-size:12.5px;font-weight:800;' +
  'letter-spacing:.03em;padding:7px 16px;border-radius:999px;margin-bottom:20px}' +
  'h1{font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-.03em;margin-bottom:14px}' +
  'p{font-family:"Newsreader",Georgia,serif;font-size:18px;line-height:1.6;color:#C9DAEC}' +
  'a{display:inline-block;margin-top:26px;color:#F0B429;font-family:"Bricolage Grotesque",Arial,sans-serif;' +
  'font-weight:700;font-size:15px;text-decoration:none;border:2px solid rgba(240,180,41,.5);' +
  'padding:13px 24px;border-radius:8px}' +
  '</style></head><body><div class="w">' +
  (badge ? '<span class="b">' + badge + '</span>' : '') +
  '<h1>' + heading + '</h1><p>' + body + '</p>' + list +
  // Where every thank you, error and already-entered page sends people
  // back to. It is the main Chanukah Fest page in the CMS; if that page
  // is ever rebuilt under a new number, this is the one place to change.
  '<a href="https://chanukahinhouston.com/">Back to Chanukah Fest 2026</a>' +
  '</div></body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('Chanukah Fest Raffle')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function namesOnEntry_(name, family) {
  var people = [name];
  for (var i = 0; i < family.length; i++) {
    people.push(family[i].age ? family[i].name + ' (' + family[i].age + ')' : family[i].name);
  }
  return people;
}

function thankYouPage_(name, family) {
  var people = namesOnEntry_(name, family || []);
  return page_("YOU'RE IN", 'Thank you!',
    people.length > 1
      ? 'All ' + people.length + ' of you are in the draw, each with your own chance to win. ' +
        'Winners are announced from the main stage throughout the afternoon — stay close and listen for your names.'
      : 'You are entered in the Chanukah Fest raffle. Winners are announced from the main stage ' +
        'throughout the afternoon — stay close and listen for your name.',
    people);
}

function alreadyInPage_(name, family) {
  return page_('ALREADY ENTERED', 'You are already in',
    'This phone number or email address has already been entered. One entry per household — ' +
    'you do not need to enter again.',
    namesOnEntry_(name, family || []));
}

function messagePage(heading, body) { return page_('', heading, body); }


/* ==================================================================
   THE SITE EDITOR
   One tab holds every change anyone has made to the wording, the
   colours, or which blocks are shown. Only differences are stored:
   anything nobody has touched is not in here at all, and the page
   keeps using the wording built into it. That is what lets the site
   carry on reading correctly if this script is ever unreachable.
   ================================================================== */

var CONTENT_HEADERS = ['What', 'Name', 'Value', 'Changed'];

function contentSheet_() {
  return tabWithHeaders_(CONTENT_NAME, CONTENT_HEADERS, '#1B6FA8', '#FFFFFF');
}

function siteContent_() {
  var sh = contentSheet_();
  var last = sh.getLastRow();
  var out = { ok: true, fields: {}, colours: {}, sections: {} };
  if (last < 2) return out;

  var rows = sh.getRange(2, 1, last - 1, 3).getValues();
  for (var i = 0; i < rows.length; i++) {
    var what = trim_(rows[i][0]), name = trim_(rows[i][1]), value = rows[i][2];
    if (!name) continue;

    if (what === 'colour') {
      out.colours[name] = trim_(value);

    } else if (what === 'section') {
      // name is "page:block"
      var bits = name.split(':');
      if (bits.length !== 2) continue;
      var rule = {};
      try { rule = JSON.parse(trim_(value) || '{}'); } catch (err) { rule = {}; }
      out.sections[bits[0]] = out.sections[bits[0]] || {};
      out.sections[bits[0]][bits[1]] = rule;

    } else {
      out.fields[name] = String(value);
    }
  }
  return out;
}

function saveSiteContent_(p) {
  var answer = function (o) {
    return ContentService.createTextOutput(JSON.stringify(o))
      .setMimeType(ContentService.MimeType.JSON);
  };

  if (trim_(p.key) !== DRAW_KEY) {
    return answer({ ok: false, error: 'wrong key' });
  }

  var edits;
  try { edits = JSON.parse(p.payload || '{}'); }
  catch (err) { return answer({ ok: false, error: 'could not read the changes' }); }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = contentSheet_();
    var last = sh.getLastRow();

    // where each name already lives, so an edit replaces rather than piles up
    var at = {};
    if (last >= 2) {
      var known = sh.getRange(2, 1, last - 1, 2).getValues();
      for (var i = 0; i < known.length; i++) {
        at[trim_(known[i][0]) + '\u0000' + trim_(known[i][1])] = i + 2;
      }
    }

    var now = new Date();
    var added = [], changed = 0;

    /* The value column is kept as plain text. Left to itself the sheet
       reads "3:00 PM" as a time and stores a time, which it counts from
       its own zero day of 30 December 1899 -- so the page was handed back
       a date in 1899 instead of the words that were typed. "December 6,
       2026" went the same way. Formatting the cell as text first means
       what comes back out is what went in. */
    var put = function (what, name, value) {
      var row = at[what + '\u0000' + name];
      if (row) {
        sh.getRange(row, 3).setNumberFormat('@');
        sh.getRange(row, 3, 1, 2).setValues([[value, now]]);
      } else {
        added.push([what, name, value, now]);
      }
      changed++;
    };

    var f = edits.fields || {};
    for (var k in f) put('text', k, String(f[k]));

    var c = edits.colours || {};
    for (var n in c) put('colour', n, String(c[n]));

    var s = edits.sections || {};
    for (var pg in s) {
      for (var blk in s[pg]) put('section', pg + ':' + blk, JSON.stringify(s[pg][blk]));
    }

    if (added.length) {
      var block = sh.getRange(sh.getLastRow() + 1, 1, added.length, 4);
      block.offset(0, 2, added.length, 1).setNumberFormat('@');   /* before the write */
      block.setValues(added);
    }
    return answer({ ok: true, saved: changed });

  } catch (err) {
    return answer({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* Puts every page back to the wording built into it. */
function resetSiteText() {
  var ui = SpreadsheetApp.getUi();
  var sh = contentSheet_();
  var last = sh.getLastRow();
  if (last < 2) {
    ui.alert('Nothing to undo', 'No changes have been saved.', ui.ButtonSet.OK);
    return;
  }
  var sure = ui.alert('Put the site back?',
    (last - 1) + ' saved change' + (last === 2 ? '' : 's') + ' will be removed and every ' +
    'page will go back to its original wording, colours and layout.\n\nThis cannot be undone.',
    ui.ButtonSet.YES_NO);
  if (sure !== ui.Button.YES) return;
  sh.deleteRows(2, last - 1);
  ui.alert('Done', 'Every page is back to how it was built.', ui.ButtonSet.OK);
}

/* ==================================================================
   6. REGISTRATIONS, PASSES AND THE DOOR
   ------------------------------------------------------------------
   Chabad's booking form lives on their server, and a form inside a
   frame from another company is sealed off from this site completely.
   So nothing here listens to the form. It listens to the inbox.

   Every booking sends a confirmation from their system. This reads
   those as they land, writes the household into the sheet, gives it a
   ticket number, and emails the person their own pass with that
   number as a QR code. The volunteers on the gate scan the pass and
   this tells them who it is, how many are expected, and whether that
   code has already walked through a different gate.

   The chain, end to end:

     they book  ->  Chabad emails the receipt
                ->  pollRegistrationEmails() reads it (every 5 minutes)
                ->  a row in 'Registrations', with a ticket
                ->  their pass goes out, QR and all
                ->  a volunteer scans it at the door
   ================================================================== */

var REG_NAME   = 'Registrations';
var STAFF_NAME = 'Check-in staff';

var REG_HEADERS = [
  'Registered at', 'Ticket', 'First name', 'Last name', 'Phone', 'Email',
  'Address', 'City', 'State', 'Zip', 'Party size', 'Guests',
  'Pass sent', 'Checked in at', 'Checked in by', 'Scans', 'How', 'Who is in'
];

var R = {
  TIME: 1, TICKET: 2, FIRST: 3, LAST: 4, PHONE: 5, EMAIL: 6,
  ADDRESS: 7, CITY: 8, STATE: 9, ZIP: 10, PARTY: 11, GUESTS: 12,
  SENT: 13, IN_AT: 14, IN_BY: 15, SCANS: 16, HOW: 17, IN_LIST: 18
};

var STAFF_HEADERS = ['Name', 'Code', 'Added', 'Last used', 'People scanned'];
var S = { NAME: 1, CODE: 2, ADDED: 3, USED: 4, COUNT: 5 };

/* Every scan, in the order it happened.

   The Registrations tab records who let a household in, which answers
   "who checked this family in" but nothing else. It keeps only the
   first scan, so a pass presented twice at two gates leaves no trace
   of the second, and a volunteer scanning the wrong thing all evening
   looks identical to one scanning nothing.
   
   This is the other view: one line per scan, successful or not. It is
   what you read when you want to know whether somebody was actually
   on the gate, or what happened to one particular family. */
/* Which tab the raffle draws from.

   While the website still carries Joseph's own form, entries land on
   'Entries' and that is what the draw must read. The day the site
   switches to Chabad's form, registrations land on 'Registrations'
   instead, and this changes to match.

   One word, in one place, rather than two versions of the file to
   keep straight. Set it wrong and the draw reads an empty tab, which
   is obvious the moment you open the draw page -- it says how many
   tickets it found. */
var DRAW_READS = 'Registrations';      // 'Entries' or 'Registrations'

var LOG_NAME = 'Door log';
var LOG_HEADERS = ['Time', 'Volunteer', 'Ticket', 'Name', 'People', 'Result', 'How'];

/* The marker Chabad's email carries. See the template this is paired
   with: one line of white text at the foot of their confirmation. */
var INTAKE_MARK = 'CF26DATA';
var INTAKE_SEP  = '~|~';

/* Which messages to look at. Narrow on purpose: anything this search
   does not match is simply left alone in the inbox. */
/* Deliberately loose. An earlier version also asked Gmail to find the
   marker, which looked tidy and was a mistake: Gmail splits text into
   words its own way, and CF26DATA~|~Mendel is not reliably the word
   CF26DATA. A search that quietly matches nothing is the worst kind
   of bug, because it looks exactly like no registrations. So the
   search is wide and the marker is checked here, in code, where a
   miss can be counted and reported. */
var INTAKE_QUERY = 'from:(chabadoutreach.org OR chabadms.com) newer_than:14d';
var INTAKE_LABEL = 'cf26-registered';

/* The query the AUTOMATIC run uses.
 *
 * The wide query above matches every confirmation of the last
 * fortnight, handled or not -- so running it on a timer meant
 * re-reading the same threads over and over. At one run a minute
 * that was around 170,000 Gmail reads a day, which is what spent the
 * Gmail service quota: the account could still SEND (1,454 left), it
 * just was not allowed to READ any more.
 *
 * Dropping the threads already dealt with is what makes the timer
 * cheap: a quiet minute now costs one search that finds nothing.
 * The catch is that a thread is labelled as a whole, so a NEW
 * registration arriving inside an old conversation would hide behind
 * the label. WIDE_SWEEP_MINUTES below is the answer to that. */
var INTAKE_QUERY_AUTO = 'from:(chabadoutreach.org OR chabadms.com) ' +
                        'newer_than:3d -label:' + INTAKE_LABEL;

/* How often the automatic run ignores the label and looks at
 * everything, to catch a message added to a conversation already
 * labelled. Cheap at this spacing, and never more than this far
 * behind. */
var WIDE_SWEEP_MINUTES = 20;

/* Which messages have already been dealt with.
   
   This used to be the Gmail label alone, and that was wrong. Gmail
   groups by subject, and every one of Chabad's notifications carries
   the same subject -- so they pile into a single conversation. Mark
   the conversation as done and the next registration to land in it
   is never looked at again. Unmark it and every pass in it goes out
   a second time.
   
   So the record is kept per message instead. The label stays, purely
   so a human can see at a glance what has been handled. */
var SEEN_NAME = '_handled';

/* How often the inbox is read. Google allows 1, 5, 10, 15 or 30.
   One minute is the floor, and it is the right floor for a gate:
   somebody registering on the pavement outside should not be stood
   there waiting on us. */
var INTAKE_EVERY_MINUTES = 5;

/* Ticket codes. No O/0/I/1/L, because these get read aloud across a
   crowded gate and typed in by hand when a camera will not focus. */
var TICKET_ABC = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
var TICKET_LEN = 8;
var TICKET_TAG = 'CF26:';

var PASS_SUBJECT = 'Your Chanukah Fest pass';

/* Chabad's {Email} tag hands back the organisation's own address
   rather than the person's. Until their template is fixed, an
   address on these domains is treated as no address at all: it is
   not somebody's email, so it must not be used to recognise a
   household, and a pass must certainly not be posted to it.

   Two registrations both carrying the office address would
   otherwise look like the same family, and the second person would
   be quietly turned away as a duplicate. */
var ORG_DOMAINS = ['chabadoutreach.org', 'chanukahinhouston.com'];

function isOrgAddress_(email) {
  var e = trim_(email).toLowerCase();
  if (!e || e.indexOf('@') < 0) return false;
  var at = e.split('@')[1];
  for (var i = 0; i < ORG_DOMAINS.length; i++) {
    if (at === ORG_DOMAINS[i] || at.slice(-(ORG_DOMAINS[i].length + 1)) === '.' + ORG_DOMAINS[i]) {
      return true;
    }
  }
  return false;
}

/* Whether Chabad's guest count already includes the person booking.

   It does. Their form asks for a quantity of family members and then
   a name row for each, and the person registering has to enter
   themselves as one of them -- so a family of six enters six, not
   five plus themselves. Adding one on top made every pass read one
   person too many.

   If their form is ever changed so the booker is counted separately,
   set this back to false. */
var PARTY_INCLUDES_REGISTRANT = true;


/* ---------- the two new tabs ---------- */

function getRegSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(REG_NAME) || ss.insertSheet(REG_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(REG_HEADERS);
    sh.getRange(1, 1, 1, REG_HEADERS.length)
      .setFontWeight('bold').setBackground('#0A1E38').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setColumnWidth(R.TICKET, 120);
  } else {
    // A tab made by an earlier version is short a heading or two.
    // Fill those in rather than making him start the sheet again
    // with registrations already in it.
    //
    // Read the heading row itself rather than asking the sheet how
    // wide it is: rows written by a newer version are already the
    // full width, so the sheet looks complete while the headings
    // above them are not.
    var head = sh.getRange(1, 1, 1, REG_HEADERS.length).getValues()[0];
    for (var c = 0; c < REG_HEADERS.length; c++) {
      if (trim_(head[c]) === REG_HEADERS[c]) continue;
      if (trim_(head[c])) continue;                 // renamed by hand: leave it
      sh.getRange(1, c + 1).setValue(REG_HEADERS[c])
        .setFontWeight('bold').setBackground('#0A1E38').setFontColor('#FFFFFF');
    }
  }
  return sh;
}

/** The tab holding the id of every message already dealt with. */
function getSeenSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SEEN_NAME);
  if (!sh) {
    sh = ss.insertSheet(SEEN_NAME);
    sh.appendRow(['Message id', 'Handled at', 'What happened']);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold')
      .setBackground('#0A1E38').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    try { sh.hideSheet(); } catch (e) {}
  }
  return sh;
}

/**
 * Carry the old thread marks over to the new per-message record.
 *
 * Until v19 this script only ever marked whole conversations. v19
 * stopped trusting that and started keeping a note of each message
 * instead -- which, on the first run after the upgrade, made every
 * email in the inbox look brand new. Everyone who had ever
 * registered got their pass again.
 *
 * So before the first run, anything already carrying the old label
 * is written into the new record as handled. Runs once: after that
 * the record is not empty and this does nothing.
 */
function seedHandledFromOldLabel_() {
  var sh = getSeenSheet_();
  if (sh.getLastRow() > 1) return 0;          // already has a record

  var label = GmailApp.getUserLabelByName(INTAKE_LABEL);
  if (!label) return 0;                        // nothing was ever marked

  var rows = [], seen = {};
  for (var page = 0; page < 10; page++) {
    var threads = label.getThreads(page * 100, 100);
    if (!threads.length) break;
    for (var i = 0; i < threads.length; i++) {
      var msgs = threads[i].getMessages();
      for (var m = 0; m < msgs.length; m++) {
        var id = '';
        try { id = msgs[m].getId(); } catch (e) { continue; }
        if (!id || seen[id]) continue;
        seen[id] = true;
        rows.push([id, new Date(), 'Handled before the upgrade']);
      }
    }
    if (threads.length < 100) break;
  }

  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
    console.log('Carried ' + rows.length + ' already-handled messages over from the old label.');
  }
  return rows.length;
}

function messagesAlreadyHandled_() {
  var sh = getSeenSheet_(), last = sh.getLastRow(), seen = {};
  if (last < 2) return seen;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    var id = trim_(ids[i][0]);
    if (id) seen[id] = true;
  }
  return seen;
}

function getLogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(LOG_NAME) || ss.insertSheet(LOG_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(LOG_HEADERS);
    sh.getRange(1, 1, 1, LOG_HEADERS.length)
      .setFontWeight('bold').setBackground('#0A1E38').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 160);
    sh.setColumnWidth(4, 200);
  }
  return sh;
}

/* Writing the log must never cost somebody their entry. By the time
   this runs the person is already through the gate. */
function logScan_(staff, ticket, name, party, result, how) {
  try {
    getLogSheet_().appendRow([
      new Date(),
      trim_(staff && (staff.name || staff.code)) || '(unknown)',
      trim_(ticket),
      trim_(name),
      party || '',
      result,
      how || ''
    ]);
  } catch (err) {
    console.error('Could not write the door log: ' + (err && err.message || err));
  }
}

function getStaffSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(STAFF_NAME) || ss.insertSheet(STAFF_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(STAFF_HEADERS);
    sh.getRange(1, 1, 1, STAFF_HEADERS.length)
      .setFontWeight('bold').setBackground('#F0B429').setFontColor('#16202E');
    sh.setFrozenRows(1);
    sh.setColumnWidth(S.CODE, 140);
  }
  return sh;
}


/* ---------- ticket numbers ---------- */

function makeTicket_() {
  var s = '';
  for (var i = 0; i < TICKET_LEN; i++) {
    s += TICKET_ABC.charAt(Math.floor(Math.random() * TICKET_ABC.length));
  }
  return s;
}

/** A ticket nobody holds yet. Collisions are vanishingly unlikely and
    still worth not shipping. */
function freshTicket_(taken) {
  for (var i = 0; i < 50; i++) {
    var t = makeTicket_();
    if (!taken || !taken[t]) return t;
  }
  throw new Error('Could not find a free ticket number');
}

function ticketsInUse_() {
  var sh = getRegSheet_(), last = sh.getLastRow(), taken = {};
  if (last < 2) return taken;
  var col = sh.getRange(2, R.TICKET, last - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    var t = trim_(col[i][0]); if (t) taken[t] = true;
  }
  return taken;
}


/* ---------- reading what Chabad sent ---------- */

/**
 * Pull the household out of one confirmation email.
 *
 * The hidden line is the whole point. Their table layout is theirs to
 * change, and a parser that reads a layout breaks the first morning
 * somebody tidies a column. One line, fixed order, read exactly.
 *
 * Returns null when the line is not there, and the caller leaves the
 * message alone rather than guessing. A registration recorded wrongly
 * is worse than one not recorded at all: the wrong one is believed.
 */
function parseRegistrationEmail_(body) {
  var i = body.indexOf(INTAKE_MARK);
  if (i < 0) return null;

  // from the marker to the END sentinel, with any tags that the mail
  // client wrapped around it taken back off
  var rest = body.slice(i);
  var end = rest.indexOf('END');
  if (end < 0) return null;
  var line = rest.slice(0, end)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');

  var f = line.split(INTAKE_SEP);
  if (f.length < 10) return null;

  // f[0] is the marker itself, so the fields start at 1 and the party
  // size is the tenth of them.
  var get = function (n) { return trim_(f[n]).replace(/\s+/g, ' '); };
  var guests = parseInt(digits_(get(9)), 10);
  if (isNaN(guests) || guests < 0) guests = 0;
  var party = PARTY_INCLUDES_REGISTRANT ? guests : guests + 1;

  var out = {
    first:   get(1),
    last:    get(2),
    phone:   digits_(get(3)),
    email:   get(4).toLowerCase(),
    address: get(5),
    city:    get(6),
    state:   get(7),
    zip:     get(8),
    guests:  guests,
    party:   (party > 0 ? party : 1)
  };
  if (isOrgAddress_(out.email)) {
    out.theirEmailWasOurs = out.email;
    out.email = '';
  }

  if (!out.first && !out.last && !out.phone) return null;
  return out;
}

/**
 * Read a "Form Submission Notification" from forms@chabadms.com.
 *
 * This is the better of the two emails Chabad sends, and the one the
 * office actually receives. Every field sits on its own row with a
 * label beside it -- First Name, Email, Phone, Zip -- so nothing has
 * to be smuggled through in a hidden line, and nothing depends on a
 * merge tag meaning what we hoped it meant.
 *
 * The address is taken from the Email row, and from the reply-to
 * header if that row is ever empty. Their form sets reply-to to the
 * person who registered, which makes it the one part of this that
 * cannot be mistyped.
 */
function parseSubmission_(html, replyTo) {
  var body = String(html || '');
  if (body.indexOf('Submission Detail') < 0 && body.indexOf('Form Submission') < 0) return null;

  var fields = {};
  var rows = body.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (var i = 0; i < rows.length; i++) {
    var cells = rows[i].match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    if (cells.length < 2) continue;

    var label = cellText_(cells[0]).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (!label) continue;

    if (fields[label] === undefined) fields[label] = cellText_(cells[1]);
    if (label.indexOf('guest') > -1) fields['__' + label] = cells[1];
  }

  var pick = function () {
    for (var a = 0; a < arguments.length; a++) {
      var v = trim_(fields[arguments[a]]);
      if (v) return v;
    }
    return '';
  };

  var email = pick('email', 'email address', 'e mail').toLowerCase();
  if (!email || email.indexOf('@') < 0) {
    var m = String(replyTo || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    email = m ? m[0].toLowerCase() : '';
  }

  var out = {
    first:   pick('first name', 'firstname'),
    last:    pick('last name', 'lastname'),
    phone:   digits_(pick('phone', 'phone number', 'telephone', 'mobile', 'cell')),
    email:   email,
    address: pick('address', 'street address', 'address 1'),
    city:    pick('city'),
    state:   pick('state', 'province'),
    zip:     digits_(pick('zip', 'zip code', 'postal code', 'postcode'))
  };

  if (!out.first && !out.last && !out.email && !out.phone) return null;

  // The guest numbers live in a table inside a cell, and a row
  // pattern cannot see into that: it stops at the first </tr>, which
  // belongs to the inner table. So find the label in the raw email
  // and take the whole nested table that follows it, brackets
  // counted properly.
  var guests = guestCountFrom_(tableAfterLabel_(body, 'guest total') ||
                               tableAfterLabel_(body, 'guest detail'));
  out.guests = guests;
  out.party = PARTY_INCLUDES_REGISTRANT ? (guests || 1) : guests + 1;
  if (out.party < 1) out.party = 1;

  if (isOrgAddress_(out.email)) {
    out.theirEmailWasOurs = out.email;
    out.email = '';
  }
  return out;
}

/** The whole <table>...</table> that follows a label, nesting and all. */
function tableAfterLabel_(body, label) {
  var lower = String(body).toLowerCase();
  var at = lower.indexOf(String(label).toLowerCase());
  if (at < 0) return '';

  var start = lower.indexOf('<table', at);
  if (start < 0) return '';

  var depth = 0, i = start;
  while (i < body.length) {
    if (lower.substr(i, 6) === '<table') { depth++; i += 6; }
    else if (lower.substr(i, 7) === '</table') {
      depth--;
      i += 7;
      if (depth === 0) {
        var close = lower.indexOf('>', i);
        return body.slice(start, close < 0 ? i : close + 1);
      }
    } else { i++; }
  }
  return body.slice(start);
}

/**
 * The names typed into their form, from the Guest Details table.
 *
 * Their notification is a column of labels and values, so sweeping
 * every cell the way the confirmation needs picks up "First Name"
 * and "Zip" as if they were people. This reads only the guest table,
 * and only the cells in it that look like parts of a name.
 */
/** Whichever of the two emails this is, the names on it. */
function namesFrom_(html) {
  var body = String(html || '');
  var isNotify = body.indexOf('Submission Detail') > -1 ||
                 body.indexOf('Form Submission') > -1;
  return isNotify ? guestNamesFromSubmission_(body) : guestNamesFromEmail_(body);
}

function guestNamesFromSubmission_(html) {
  try {
    var block = tableAfterLabel_(html, 'guest detail') ||
                tableAfterLabel_(html, 'guest information');
    if (!block) return '';

    var LABEL = /^(#|no|num|number|first|last|name|first name|last name|type|guest|guest type|family member|adult|child|children|member|total|qty|quantity)$/i;

    var names = [], seen = {};
    var rows = block.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
      var parts = [];

      for (var c = 0; c < cells.length; c++) {
        var txt = cellText_(cells[c]);
        if (!txt || txt.length > 30) continue;
        if (LABEL.test(txt)) continue;

        // A heading made of two words -- "Amount Discount", "Guest
        // Type" -- slips past a list of single words. Nobody is
        // called Amount, so any cell carrying one of these words
        // anywhere in it is a heading, not a person.
        if (/\b(amount|discount|total|totals|subtotal|price|cost|fee|paid|qty|quantity|number|type|types|name|first|last|guest|guests|member|members|adult|adults|child|children|family|detail|details|information|expiration|card|donation|payment|address|city|state|zip|email|phone|month|year|date)\b/i.test(txt)) continue;

        if (!/^[A-Za-z][A-Za-z .'\-]*[A-Za-z.]$/.test(txt)) continue;
        parts.push(txt);
      }

      var name = parts.join(' ').replace(/\s+/g, ' ').trim();
      if (!name || name.length < 2) continue;

      var key = name.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      names.push(name);
      if (names.length >= 20) break;
    }
    return names.join('; ');
  } catch (err) {
    return '';
  }
}

function cellText_(cell) {
  return String(cell)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * How many guests the Guest Totals block describes.
 *
 * Their table lists a number per guest type and, usually, a Total row
 * underneath. Read the Total where there is one; sum the types where
 * there is not. Adding both would count every family twice, and
 * taking the largest would lose the children.
 */
function guestCountFrom_(blockHtml) {
  var block = String(blockHtml || '');
  if (!block) return 0;

  var rows = block.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  var sum = 0, total = -1;

  for (var i = 0; i < rows.length; i++) {
    var cells = rows[i].match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    var texts = [];
    for (var c = 0; c < cells.length; c++) texts.push(cellText_(cells[c]));
    var line = texts.join(' ').toLowerCase();

    var n = -1;
    for (var t = 0; t < texts.length; t++) {
      if (/^\d{1,3}$/.test(texts[t])) { n = parseInt(texts[t], 10); break; }
    }
    if (n < 0) continue;

    if (/\btotal\b/.test(line)) total = n;
    else sum += n;
  }

  return total >= 0 ? total : sum;
}


/**
 * Guest names, if they can be had.
 *
 * A nicety for the person on the gate, never a reason to fail: the
 * headcount comes from the hidden line and is what actually matters.
 *
 * The first version of this swept every cell in their email and kept
 * anything that looked like words. Which is how a card type and an
 * expiry date ended up filed under somebody's guests. Payment
 * details have no business in a list a volunteer reads out at a
 * barrier, so now the payment half of the email is cut off before
 * anything is read, and a cell has to actually look like a name --
 * letters only, no digits anywhere near it.
 */
function guestNamesFromEmail_(html) {
  try {
    var body = String(html);

    // everything from the payment section down is none of our business
    var cut = body.search(/Payment\s*Information/i);
    if (cut > 0) body = body.slice(0, cut);

    var SKIP = /^(#|name|type|total|number|amount|guest|guests|contact|payment|information|adult|child|children|family|member|members|visa|mastercard|amex|american express|discover|card|cardholder|expiry|expiration|donation|purpose|registration|reservation|qty|quantity|price|subtotal|fee|free|n\/a|none|yes|no)$/i;

    var names = [], seen = {};
    var cells = body.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];

    for (var i = 0; i < cells.length; i++) {
      var txt = cells[i]
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();

      if (!txt || txt.length < 2 || txt.length > 40) continue;
      if (SKIP.test(txt)) continue;

      // their own headings and category words, which are not people
      if (/\b(information|member|members|adult|adults|child|children|guest|guests|total|amount|type|number|payment|card|donation)\b/i.test(txt)) continue;

      // a name: letters, and the bits that go between them. Nothing
      // with a digit in it, which keeps every card number, expiry,
      // amount and phone number out by construction.
      if (!/^[A-Za-z][A-Za-z .'\-]*[A-Za-z.]$/.test(txt)) continue;

      var key = txt.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      names.push(txt);
      if (names.length >= 20) break;
    }
    return names.join('; ');
  } catch (err) {
    return '';
  }
}

/* ---------- the QR, and the pass it sits in ---------- */

/**
 * Draw the ticket number as a QR code, here, in the email.
 *
 * This used to ask an outside service for a picture of it, which
 * needed a permission a managed Workspace account would not grant --
 * and which would have put a few thousand passes at the mercy of
 * somebody else's server on the one evening it matters.
 *
 * So the code is drawn instead of fetched: the generator at the foot
 * of this file works out the pattern, and this turns it into a table
 * of black and white cells. Every mail client can draw a table.
 *
 * Runs of the same colour share one cell, which roughly halves the
 * size of the email. Gmail cuts a message off past about 100KB, and
 * a pass whose bottom half is missing is worse than no pass.
 */
function qrTable_(text, px) {
  px = px || 8;

  var q = qrcode(0, 'M');
  q.addData(String(text));
  q.make();

  var n = q.getModuleCount();
  var quiet = px * 4;                 /* the white margin a reader needs */
  var rows = [];

  for (var r = 0; r < n; r++) {
    var cells = [], run = 1;
    for (var c = 0; c < n; c++) {
      var dark = q.isDark(r, c);
      if (c + 1 < n && q.isDark(r, c + 1) === dark) { run++; continue; }
      cells.push(
        '<td' + (run > 1 ? ' colspan="' + run + '"' : '') +
        ' width="' + (run * px) + '" height="' + px + '"' +
        ' bgcolor="' + (dark ? '#000000' : '#FFFFFF') + '"' +
        ' style="width:' + (run * px) + 'px;height:' + px + 'px;' +
        'background-color:' + (dark ? '#000000' : '#FFFFFF') + ';' +
        'padding:0;margin:0;font-size:0;line-height:0;border:0">&nbsp;</td>');
      run = 1;
    }
    rows.push('<tr style="height:' + px + 'px">' + cells.join('') + '</tr>');
  }

  var grid = '<table cellpadding="0" cellspacing="0" border="0" role="presentation" ' +
             'style="border-collapse:collapse;border-spacing:0;margin:0 auto;' +
             'background-color:#FFFFFF"><tbody>' + rows.join('') + '</tbody></table>';

  /* The white margin is not decoration: a reader needs clear ground
     round the pattern or it cannot find its edges. Padding on a table
     is ignored by several mail clients, so it goes on a cell of its
     own, which none of them ignore. */
  return '<table cellpadding="0" cellspacing="0" border="0" role="presentation" ' +
         'style="border-collapse:collapse;margin:0 auto;background-color:#FFFFFF">' +
         '<tbody><tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;' +
         'padding:' + quiet + 'px;line-height:0;font-size:0">' +
         grid + '</td></tr></tbody></table>';
}

function passHtml_(row) {
  var name  = fullName_(row.first, row.last);
  var first = trim_(row.first) || name || 'there';
  var code  = TICKET_TAG + row.ticket;

  var who = row.party > 1
    ? 'This one pass covers all ' + row.party + ' of you, so come to the gate together.'
    : 'This pass is for one person.';

  var qrBlock;
  try {
    qrBlock = qrTable_(code);
  } catch (err) {
    // Never let a drawing failure cost somebody their pass. The
    // number underneath can be typed in at the gate.
    console.error('QR for ' + code + ' would not draw: ' + (err && err.message || err));
    qrBlock = '<div style="font-size:14px;color:#46566A;padding:8px 0">' +
              'Show the number below at the gate.</div>';
  }

  var gold = 'font-size:11px;font-weight:bold;letter-spacing:1.5px;' +
             'color:#8A6A1E;text-transform:uppercase;padding-bottom:12px';
  var label = 'padding:7px 0;color:#6B7C90;font-size:13.5px';
  var value = 'padding:7px 0;font-weight:bold';

  return '' +
  '<div style="margin:0;padding:0;background:#EEF2F7">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EEF2F7" style="background:#EEF2F7">' +
  '<tr><td align="center" style="padding:22px 12px">' +
  '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">' +

  /* banner */
  '<tr><td style="padding:0">' +
  '<img src="https://chanukahinhouston.com/images/banner-wide.jpg" width="600" alt="Houston Chanukah Fest" style="display:block;width:100%;max-width:600px;height:auto;border:0">' +
  '</td></tr>' +

  /* headline */
  '<tr><td bgcolor="#0A1E38" style="background:#0A1E38;padding:28px 34px 26px;text-align:center">' +
  '<div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#F0B429;text-transform:uppercase">You are registered</div>' +
  '<div style="font-size:26px;font-weight:bold;color:#FFFFFF;padding-top:9px;line-height:1.2">' + esc_(name) + '</div>' +
  '<div style="font-size:15px;color:#B9CBDE;padding-top:9px;line-height:1.5">Sunday, December 6 &middot; Houston City Hall</div>' +
  '</td></tr>' +

  /* the welcome */
  '<tr><td style="padding:26px 34px 0;font-size:15.5px;color:#16202E;line-height:1.65">' +
  'Hi ' + esc_(first) + ', we are glad you are coming. Here is your pass. ' +
  'Have it open on your phone when you reach the gate and we will scan you ' +
  'straight through &mdash; no queue, no paperwork. ' + esc_(who) +
  '</td></tr>' +

  whoIsComing_(row, gold) +

  /* the pass */
  '<tr><td align="center" style="padding:24px 34px 4px">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F6F9" style="background:#F4F6F9;border-radius:10px">' +
  '<tr><td align="center" style="padding:22px 18px">' +
  qrBlock +
  '<div style="font-size:20px;font-weight:bold;color:#16202E;letter-spacing:2px;padding-top:14px;font-family:Courier New,Courier,monospace">' + esc_(code) + '</div>' +
  '<div style="font-size:13px;color:#6B7C90;padding-top:8px;line-height:1.5">' +
  'Screenshot this now &mdash; the signal downtown can be patchy.</div>' +
  '</td></tr></table></td></tr>' +

  /* getting in */
  '<tr><td style="padding:28px 34px 0">' +
  '<div style="' + gold + '">Getting in</div>' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;color:#16202E">' +
  '<tr><td width="124" style="' + label + '">Entrance</td>' +
  '<td style="' + value + '">Smith Street<br><span style="font-weight:normal;color:#46566A">between Walker &amp; McKinney</span></td></tr>' +
  '<tr><td style="' + label + '">Festival opens</td><td style="' + value + '">3:00 PM</td></tr>' +
  '<tr><td style="' + label + '">Where</td>' +
  '<td style="' + value + '">Houston City Hall<br><span style="font-weight:normal;color:#46566A">901 Bagby St, Houston, TX 77002</span></td></tr>' +
  '</table></td></tr>' +

  /* bags */
  '<tr><td style="padding:18px 34px 0">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FEF8EC" style="background:#FEF8EC;border-radius:9px">' +
  '<tr><td style="padding:15px 18px;font-size:14.5px;color:#4A3A12;line-height:1.6">' +
  '<strong>No bags.</strong> A strict no-bag policy is enforced at the Smith Street ' +
  'checkpoint. Small clutches, diaper bags and medical supply bags are allowed, ' +
  'and all are subject to search.' +
  '</td></tr></table></td></tr>' +

  /* parking */
  '<tr><td style="padding:28px 34px 0">' +
  '<div style="' + gold + '">Parking</div>' +
  '<div style="font-size:15px;color:#16202E;line-height:1.65">' +
  '<strong>Street parking is free on Sundays.</strong> Metered spaces across ' +
  'Downtown cost nothing on the day, and they fill up early &mdash; the closer ' +
  'to 3:00 you arrive, the further out you will be walking.' +
  '</div>' +
  '<div style="font-size:15px;color:#16202E;line-height:1.65;padding-top:14px">' +
  '<strong>Or reserve a garage space in advance</strong><br>' +
  '<span style="color:#46566A">Theater District Garage (Tranquility 2), 499 Rusk St ' +
  '&mdash; a few minutes&rsquo; walk from the Smith Street gate.</span>' +
  '</div>' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="padding-top:15px">' +
  '<tr><td bgcolor="#F0B429" style="background:#F0B429;border-radius:7px">' +
  '<a href="https://app.parkmobile.io/reservation/13986?startDate=2026-12-06T15%3A00%3A00" ' +
  'style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:bold;color:#16202E;text-decoration:none">' +
  'Reserve a parking space</a>' +
  '</td></tr></table>' +
  '<div style="font-size:13.5px;color:#6B7C90;line-height:1.6;padding-top:14px">' +
  'Rideshare and carpooling are encouraged.</div>' +
  '</td></tr>' +

  /* site */
  '<tr><td style="padding:26px 34px 28px;text-align:center">' +
  '<a href="https://chanukahinhouston.com/" style="font-size:15px;font-weight:bold;color:#1B6FA8;text-decoration:none">' +
  'Schedule, line-up and FAQ &rsaquo;</a></td></tr>' +

  /* footer */
  '<tr><td bgcolor="#0A1E38" style="background:#0A1E38;padding:22px 34px;text-align:center">' +
  '<div style="font-size:14px;font-weight:bold;color:#FFFFFF">Chabad Outreach of Houston</div>' +
  '<div style="font-size:12.5px;color:#8FA6BF;padding-top:6px;line-height:1.7">' +
  '11000 Fondren Rd, Ste B-104, Houston, TX 77096<br>' +
  '<a href="tel:7137740300" style="color:#F0B429;text-decoration:none">713-774-0300</a>' +
  ' &nbsp;&middot;&nbsp; ' +
  '<a href="mailto:' + NOTIFY.raffle + '" style="color:#F0B429;text-decoration:none">' + NOTIFY.raffle + '</a>' +
  '</div>' +
  '<div style="font-size:11px;color:#5E7490;padding-top:13px;line-height:1.6">' +
  'You are receiving this because you registered for Houston Chanukah Fest 2026.</div>' +
  '</td></tr>' +

  '</table></td></tr></table></div>';
}

/**
 * Who this pass covers, by name.
 *
 * Only what their form actually gave us. Where somebody registered
 * six people and typed no names, there is nothing honest to list, so
 * the block is left out entirely rather than padded with "Guest 2".
 * A pass that names four of six says something true; one that
 * invents the other two does not.
 */
function whoIsComing_(row, gold) {
  var names = [];
  var household = fullName_(row.first, row.last);
  if (household) names.push(household);

  var guests = trim_(row.guests);
  if (guests) {
    // "Joseph Eber" and "Joseph eber" are one person. Their form
    // does not care about capitals and neither should this.
    var seen = {};
    if (household) seen[household.toLowerCase()] = true;

    var parts = guests.split(';');
    for (var i = 0; i < parts.length; i++) {
      var n = trim_(parts[i]).replace(/\s*\(\s*\d+\s*\)\s*$/, '');
      if (!n) continue;
      var key = n.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      names.push(n);
    }
  }

  if (names.length < 2) return '';

  var rows = '';
  for (var k = 0; k < names.length; k++) {
    rows += esc_(names[k]) + (k < names.length - 1 ? '<br>' : '');
  }

  var more = (row.party || names.length) - names.length;
  if (more > 0) {
    rows += '<br><span style="color:#6B7C90;font-size:14px">and ' + more +
            ' more on this pass</span>';
  }

  return '<tr><td style="padding:24px 34px 0">' +
         '<div style="' + gold + '">Who this pass covers</div>' +
         '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
         'bgcolor="#F4F6F9" style="background:#F4F6F9;border-radius:9px">' +
         '<tr><td style="padding:15px 18px;font-size:15.5px;color:#16202E;line-height:1.85">' +
         rows + '</td></tr></table></td></tr>';
}

function esc_(s) {
  return trim_(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Send one household their pass.
 *
 * Like notify_, this must never cost somebody their registration. The
 * row is already written by the time this runs. If the mail will not
 * go, the sheet still holds the booking and the gate can still find
 * them by name.
 */
function sendPass_(row) {
  if (!row.email) return '';
  if (isOrgAddress_(row.email)) {
    console.error('Refusing to post ' + row.ticket + ' to ' + row.email +
                  ' -- that is the office, not the person who registered.');
    return '';
  }
  try {
    var opts = {
      name: 'Houston Chanukah Fest',
      htmlBody: passHtml_(row)
    };
    if (NOTIFY.raffle) opts.replyTo = NOTIFY.raffle;

    MailApp.sendEmail(row.email, PASS_SUBJECT,
      'Hi ' + (trim_(row.first) || 'there') + ', here is your Chanukah Fest pass.\n\n' +
      '   ' + TICKET_TAG + row.ticket + '\n\n' +
      'Have it ready at the gate. Sunday, December 6, Houston City Hall.\n' +
      'Enter from Smith Street, between Walker and McKinney. Opens 3:00 PM.\n\n' +
      'Parking: street parking is free downtown on Sundays, or reserve a space at ' +
      'the Theater District Garage (499 Rusk St): ' +
      'https://app.parkmobile.io/reservation/13986?startDate=2026-12-06T15%3A00%3A00\n\n' +
      'No bags at the checkpoint. Full details: https://chanukahinhouston.com/',
      opts);
    return new Date();
  } catch (err) {
    console.error('Pass to ' + row.email + ' failed: ' + (err && err.message || err));
    return '';
  }
}


/* ---------- the thing that runs every five minutes ---------- */

/**
 * Read any new Chabad confirmations and turn them into registrations.
 *
 * Safe to run twice: processed threads get a label, the search skips
 * anything carrying it, and a household already in the sheet is
 * recognised by phone or email rather than added again.
 */
function pollRegistrationEmails__raw(wide) {
  var label = GmailApp.getUserLabelByName(INTAKE_LABEL) ||
              GmailApp.createLabel(INTAKE_LABEL);

  // Capped on purpose. Each message read is a slow call, and a run
  // that gets stopped halfway leaves the labelling half done.
  var startedAt = new Date().getTime();
  seedHandledFromOldLabel_();

  // A timed run skips what is already labelled; every so often it
  // looks at everything, in case a new registration landed in a
  // conversation that was labelled earlier. Reading the menu item
  // (wide === true) always looks at everything.
  if (wide !== true && wide !== false) {
    var mins = new Date().getMinutes();
    wide = (mins % WIDE_SWEEP_MINUTES) < INTAKE_EVERY_MINUTES;
  }

  var threads = GmailApp.search(wide ? INTAKE_QUERY : INTAKE_QUERY_AUTO, 0, 60);
  var seen = messagesAlreadyHandled_();
  var seenSheet = getSeenSheet_();
  var newlySeen = [];
  if (!threads.length) return { ok: true, added: 0, looked: 0 };

  var sheet = getRegSheet_();
  var taken = ticketsInUse_();
  var added = 0, skipped = 0, unreadable = 0, notARegistration = 0, grew = 0;
  var stoppedForQuota = false;

  // Gmail allows a fixed number of emails a day. Running into that
  // limit mid-send throws, which used to abandon the whole run --
  // see the try/finally below. Better to stop before the edge and
  // leave the rest for tomorrow, in order, than to find out by
  // crashing. A few are kept back for passes people ask for by hand.
  function roomToSend_() {
    try { return MailApp.getRemainingDailyQuota() > 15; }
    catch (e) { return true; }   // cannot tell: carry on and let it try
  }

  try {

  for (var t = 0; t < threads.length; t++) {
    // Leave before Google throws us out, so the label always gets
    // written for whatever was finished.
    if (new Date().getTime() - startedAt > 240000) break;

    var msgs = threads[t].getMessages();
    var handled = false;

    for (var m = 0; m < msgs.length; m++) {
      var msgId = '';
      try { msgId = msgs[m].getId(); } catch (err0) { msgId = ''; }
      if (msgId && seen[msgId]) continue;      // this exact email, already done

      var html, parsed;
      try { html = msgs[m].getBody(); }
      catch (err) { continue; }

      var replyTo = '';
      try { replyTo = msgs[m].getReplyTo(); } catch (e) {}

      // Their notification email first: every field labelled, the
      // address in a header. The hidden line is the older route and
      // stays as a fallback.
      parsed = parseSubmission_(html, replyTo);

      var hasMark = html.indexOf(INTAKE_MARK) > -1 ||
                    html.indexOf('Submission Detail') > -1;

      if (!parsed) parsed = parseRegistrationEmail_(html);
      if (!parsed) {
        try { parsed = parseRegistrationEmail_(msgs[m].getPlainBody()); }
        catch (err2) { parsed = null; }
      }
      if (!parsed) {
        // An ordinary email from the same domain is not a failure.
        // Counting the two together made twenty pieces of unrelated
        // post look like twenty broken registrations.
        if (hasMark) unreadable++; else notARegistration++;
        if (msgId) { seen[msgId] = true; newlySeen.push([msgId, new Date(),
                     hasMark ? 'Could not read' : 'Not a registration']); }
        continue;
      }

      handled = true;

      var existing = findRegistration_(sheet, parsed.phone, parsed.email, parsed.last);
      if (existing) {
        var grown = growHousehold_(sheet, existing, parsed, html);
        skipped++;
        if (msgId) { seen[msgId] = true; newlySeen.push([msgId, new Date(), 'Grew a household']); }
        if (grown.changed) grew++;
        if (grown.resend) {
          // Their pass now says the wrong number of people, so send
          // a fresh one rather than leaving them to find out at the
          // gate that two of their children are not expected.
          if (roomToSend_()) {
            var again = sendPass_(grown);
            if (again) sheet.getRange(existing, R.SENT).setValue(again);
          } else {
            sheet.getRange(existing, R.SENT)
              .setValue('Party changed - pass needs re-sending (daily email limit reached)');
            stoppedForQuota = true;
          }
        }
        continue;
      }

      var ticket = freshTicket_(taken);
      taken[ticket] = true;

      var row = {
        ticket: ticket, first: parsed.first, last: parsed.last,
        phone: parsed.phone, email: parsed.email, address: parsed.address,
        city: parsed.city, state: parsed.state, zip: parsed.zip,
        party: parsed.party, guests: namesFrom_(html)
      };

      sheet.appendRow([
        msgs[m].getDate(), ticket, row.first, row.last, row.phone, row.email,
        row.address, row.city, row.state, row.zip, row.party,
        row.guests, '', '', '', 0, '', ''
      ]);

      if (parsed.theirEmailWasOurs) {
        sheet.getRange(sheet.getLastRow(), R.SENT)
          .setValue('No pass: their form sent ' + parsed.theirEmailWasOurs +
                    ' instead of the registrant address');
      }

      // The row is written either way; only the pass waits. Leaving
      // the message UNMARKED is deliberate, so tomorrow's run sends
      // the pass that did not go out today.
      if (!roomToSend_()) {
        sheet.getRange(sheet.getLastRow(), R.SENT)
          .setValue('Waiting: daily email limit reached');
        stoppedForQuota = true;
        break;
      }

      var sent = sendPass_(row);
      if (sent) {
        sheet.getRange(sheet.getLastRow(), R.SENT).setValue(sent);
      }
      if (msgId) { seen[msgId] = true; newlySeen.push([msgId, new Date(), 'Registered']); }
      added++;
    }

    if (handled) threads[t].addLabel(label);
    if (stoppedForQuota) break;
  }

  } finally {
    // This MUST happen even if something above threw. It used to sit
    // after the loop: one failed send -- a Gmail quota, a flaky
    // moment -- abandoned the marks for every message in the run, so
    // the next run an minute later did them all again and sent their
    // passes a second time. The marks are the only thing standing
    // between a hiccup and a mailbox full of duplicate passes.
    if (newlySeen.length) {
      seenSheet.getRange(seenSheet.getLastRow() + 1, 1, newlySeen.length, 3)
        .setValues(newlySeen);
    }
  }

  var result = { ok: true, added: added, alreadyHad: skipped, grew: grew,
                 unreadable: unreadable, notRegistrations: notARegistration,
                 looked: threads.length, heldForQuota: stoppedForQuota };
  console.log('Registration intake: ' + JSON.stringify(result));
  return result;
}

/**
 * The row this registration belongs to, or 0 for a new household.
 *
 * A shared phone number is not enough on its own. One number covers a
 * whole family, and somebody registering their own household and then
 * their parents will use it twice -- two real registrations that must
 * not become one. So the surname has to match as well.
 *
 * An email address is different: two households rarely share one, so
 * a match there stands by itself. Except the office address, which
 * Chabad's form has handed us before and which belongs to nobody.
 */
function findRegistration_(sheet, phone, email, lastName) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;

  var rows = sheet.getRange(2, 1, last - 1, REG_HEADERS.length).getValues();
  var p = digits_(phone);
  var e = trim_(email).toLowerCase();
  var n = trim_(lastName).toLowerCase();

  for (var i = 0; i < rows.length; i++) {
    var rp = digits_(rows[i][R.PHONE - 1]);
    var re = trim_(rows[i][R.EMAIL - 1]).toLowerCase();
    var rn = trim_(rows[i][R.LAST - 1]).toLowerCase();

    if (e && re && !isOrgAddress_(e) && !isOrgAddress_(re) && e === re) return i + 2;

    // same number AND same surname. A surname we never got cannot
    // vouch for anything, so the number alone still counts then.
    if (p && rp && p === rp && (!n || !rn || n === rn)) return i + 2;
  }
  return 0;
}

/**
 * The same household registering a second time.
 *
 * Almost always somebody who forgot to add their children and went
 * round again. Dropping it loses those children: their pass still
 * says the old number and they are short their raffle tickets. So
 * the larger headcount wins, and any guest names we did not have
 * before are kept.
 *
 * The headcount only ever grows. A second registration listing fewer
 * people is somebody adding one more child, not withdrawing three.
 */
function growHousehold___raw(sheet, row, parsed, html) {
  var current = sheet.getRange(row, 1, 1, REG_HEADERS.length).getValues()[0];
  var was = parseInt(current[R.PARTY - 1], 10) || 1;
  var now = parseInt(parsed.party, 10) || 1;
  var changed = false;

  // Only a change in how many people are coming is worth another
  // email. Tidier spelling of a name is not: the first pass is still
  // correct, and a second one landing for no visible reason reads
  // like the system is confused.
  var headcountChanged = false;
  if (now > was) {
    sheet.getRange(row, R.PARTY).setValue(now);
    changed = true;
    headcountChanged = true;
  }

  // Replace rather than only lengthen. The email is the source of
  // truth, so re-reading it gives the right answer -- and an earlier
  // version of the scraper wrote field labels into this column,
  // which a longer-is-better rule would have preserved forever.
  var names = namesFrom_(html || '');
  if (names && names !== trim_(current[R.GUESTS - 1])) {
    sheet.getRange(row, R.GUESTS).setValue(names);
    changed = true;
  }

  // An address this time where we had none before is worth keeping.
  if (!trim_(current[R.EMAIL - 1]) && parsed.email) {
    sheet.getRange(row, R.EMAIL).setValue(parsed.email);
    changed = true;
  }

  return {
    changed: changed,
    resend: headcountChanged,
    ticket: trim_(current[R.TICKET - 1]),
    party: Math.max(was, now),
    first: trim_(current[R.FIRST - 1]),
    last: trim_(current[R.LAST - 1]),
    guests: names || trim_(current[R.GUESTS - 1]),
    email: trim_(current[R.EMAIL - 1]) || parsed.email
  };
}

/** Call this once, from the menu, to start the five-minute cycle. */
function startRegistrationIntake() {
  var all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === 'pollRegistrationEmails') {
      ScriptApp.deleteTrigger(all[i]);
    }
  }
  ScriptApp.newTrigger('pollRegistrationEmails')
    .timeBased().everyMinutes(INTAKE_EVERY_MINUTES).create();
  SpreadsheetApp.getUi().alert(
    'Registration intake is on.\n\n' +
    'Chabad confirmations will be read every ' + INTAKE_EVERY_MINUTES +
    ' minute' + (INTAKE_EVERY_MINUTES === 1 ? '' : 's') + ', written to the ' +
    '"' + REG_NAME + '" tab, and each household emailed their pass.\n\n' +
    'Anything already sitting in the inbox from the last 14 days gets ' +
    'picked up on the first run, so nothing registered earlier is lost.');
}


/* ---------- the gate ---------- */

/** The staff row for a code, or null. */
/* The staff and admin tabs are tiny and almost never change, yet
   every single request read one of them before doing anything else -
   about a second each time. They are now kept for a minute and
   forgotten the moment a volunteer or admin is added or removed. */
var PEOPLE_CACHE_SECONDS = 60;

function staffRows_() {
  return cachedList_('staffRows', function () {
    var sh = getStaffSheet_(), last = sh.getLastRow();
    if (last < 2) return { rows: [] };
    return { rows: sh.getRange(2, 1, last - 1, STAFF_HEADERS.length).getValues() };
  }, PEOPLE_CACHE_SECONDS).rows;
}

function adminRows_() {
  return cachedList_('adminRows', function () {
    var sh = getAdminSheet_(), last = sh.getLastRow();
    if (last < 2) return { rows: [] };
    return { rows: sh.getRange(2, 1, last - 1, ADMIN_HEADERS.length).getValues() };
  }, PEOPLE_CACHE_SECONDS).rows;
}

function forgetPeople_() {
  var c = listCache_();
  if (c) { try { c.removeAll(['staffRows', 'adminRows']); } catch (e) {} }
}

function findStaff_(code) {
  var c = trim_(code).toUpperCase();
  if (!c) return null;
  var rows = staffRows_();
  for (var i = 0; i < rows.length; i++) {
    if (trim_(rows[i][S.CODE - 1]).toUpperCase() === c) {
      return { row: i + 2, name: trim_(rows[i][S.NAME - 1]), code: c };
    }
  }
  return null;
}

/**
 * Everything the gate needs, so a phone can go on working when the
 * signal at City Hall gives out. Names and numbers only; no address,
 * no phone number, no email address leaves for this.
 */
/* ------------------------------------------------------------------
   A short cache in front of the two big reads.

   Every phone at the gate re-reads the whole Registrations tab every
   45 seconds, and the admin page every 20. Reading the tab is most of
   the 2-5 seconds a load takes. So the built list is kept for
   LIST_CACHE_SECONDS and handed to the next caller as is; only the
   first phone in each window pays for the read.

   Anything that WRITES to Registrations clears it (see forgetLists_
   and the wrappers at the end of this file), so an undo in the admin
   or a check-in at the gate shows up on the very next read. If a
   write path were ever missed, the cache still expires on its own,
   so the worst case is a list a few seconds older than today's. */
var LIST_CACHE_SECONDS = 30;
var LIST_KEYS = ['roster', 'adminPeople'];

function listCache_() {
  try { return CacheService.getScriptCache(); } catch (e) { return null; }
}

function cachedList_(key, build, seconds) {
  var c = listCache_();
  if (c) {
    try { var hit = c.get(key); if (hit) return JSON.parse(hit); } catch (e) {}
  }
  var fresh = build();
  if (c) {
    try {
      var packed = JSON.stringify(fresh);
      if (packed.length < 95000) c.put(key, packed, seconds || LIST_CACHE_SECONDS);  // the cache's own limit is 100KB
    } catch (e) {}
  }
  return fresh;
}

function forgetLists_() {
  var c = listCache_();
  if (c) { try { c.removeAll(LIST_KEYS); } catch (e) {} }
}

function rosterForScanner_(staff) {
  var shared = cachedList_('roster', buildRoster_);
  return { ok: true, who: staff.name, count: shared.list.length,
           at: new Date().getTime(), list: shared.list };
}

function buildRoster_() {
  var sh = getRegSheet_(), last = sh.getLastRow(), list = [];
  if (last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, REG_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      var ticket = trim_(rows[i][R.TICKET - 1]);
      if (!ticket) continue;
      var at = rows[i][R.IN_AT - 1];
      list.push({
        t: ticket,
        n: fullName_(rows[i][R.FIRST - 1], rows[i][R.LAST - 1]),
        p: parseInt(rows[i][R.PARTY - 1], 10) || 1,
        g: trim_(rows[i][R.GUESTS - 1]),
        c: at ? new Date(at).getTime() : 0,
        b: trim_(rows[i][R.IN_BY - 1]),
        h: trim_(rows[i][R.HOW - 1]),
        i: trim_(rows[i][R.IN_LIST - 1])      /* who is already through */
      });
    }
  }
  return { list: list };
}

/**
 * Take one person through the gate.
 *
 * The phone has already decided what to show -- it holds the roster
 * and answers instantly, which is the only thing that works in a
 * queue. This is the record that settles it: two gates scanning the
 * same pass a minute apart both reach this, and the second one is
 * told the first already happened.
 */
/**
 * Take some or all of a party through the gate.
 *
 * A family of six does not always arrive as six. One parent parks
 * the car while the other takes the children in, and the second
 * group should not meet a screen that says they already came.
 *
 * So a pass is not a door that opens once. It carries a list of
 * people, and each of them goes through at most once. `who` is the
 * names the volunteer ticked; leaving it out admits everyone still
 * outstanding, which is what an ordinary scan means.
 *
 * Statuses: 'in' when somebody new went through, 'again' when every
 * one of them was already inside, 'unknown' for a pass not on the
 * list.
 */
function checkIn___raw(staff, ticket, how, who) {
  var t = trim_(ticket).toUpperCase().replace(TICKET_TAG, '');
  var byHand = (trim_(how).toLowerCase() === 'manual');

  if (!t) {
    logScan_(staff, ticket, '', '', 'Nothing readable', byHand ? 'by hand' : 'scanned');
    return { ok: false, status: 'unknown' };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (err) { return { ok: false, status: 'busy' }; }

  try {
    var sh = getRegSheet_(), last = sh.getLastRow();
    if (last < 2) {
      logScan_(staff, t, '', '', 'Not on the list', byHand ? 'by hand' : 'scanned');
      return { ok: true, status: 'unknown', ticket: t };
    }

    var rows = sh.getRange(2, 1, last - 1, REG_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (trim_(rows[i][R.TICKET - 1]).toUpperCase() !== t) continue;

      var row = i + 2;
      var household = fullName_(rows[i][R.FIRST - 1], rows[i][R.LAST - 1]);
      var party = parseInt(rows[i][R.PARTY - 1], 10) || 1;
      var people = peopleOnRegistration_(rows[i]);

      var alreadyIn = namesToMap_(rows[i][R.IN_LIST - 1]);

      // Rows checked in before this version carry a time but no
      // names: back then a scan admitted the whole party. That is
      // what it meant, so honour it rather than letting them all
      // through again.
      var namedAny = false;
      for (var seenKey in alreadyIn) if (alreadyIn.hasOwnProperty(seenKey)) { namedAny = true; break; }
      if (!namedAny && rows[i][R.IN_AT - 1]) {
        for (var q = 0; q < people.length; q++) alreadyIn[people[q].name.toLowerCase()] = true;
      }
      var asked = namesToMap_(who);
      var takeAll = !trim_(who);

      var admitted = [], state = [];
      for (var k = 0; k < people.length; k++) {
        var name = people[k].name;
        var key = name.toLowerCase();
        var wasIn = !!alreadyIn[key];
        var nowIn = wasIn;

        if (!wasIn && (takeAll || asked[key])) {
          nowIn = true;
          alreadyIn[key] = true;
          admitted.push(name);
        }
        state.push({ n: name, in: nowIn, was: wasIn });
      }

      var scans = (parseInt(rows[i][R.SCANS - 1], 10) || 0) + 1;
      sh.getRange(row, R.SCANS).setValue(scans);

      var inCount = 0;
      for (var c = 0; c < state.length; c++) if (state[c].in) inCount++;

      if (!admitted.length) {
        logScan_(staff, t, household, party, 'Everyone already in', 'scanned again');
        return { ok: true, status: 'again', ticket: t, name: household,
                 party: party, people: state, inCount: inCount,
                 at: rows[i][R.IN_AT - 1] ? new Date(rows[i][R.IN_AT - 1]).getTime() : 0,
                 by: trim_(rows[i][R.IN_BY - 1]),
                 how: trim_(rows[i][R.HOW - 1]) || 'scanned', scans: scans };
      }

      var now = new Date();
      sh.getRange(row, R.IN_LIST).setValue(mapToNames_(people, alreadyIn));
      if (!rows[i][R.IN_AT - 1]) {
        sh.getRange(row, R.IN_AT).setValue(now);
        sh.getRange(row, R.HOW).setValue(byHand ? 'by hand' : 'scanned');
      }
      sh.getRange(row, R.IN_BY).setValue(staff.name || staff.code);
      bumpStaff_(staff, admitted.length);

      logScan_(staff, t, household + ' (' + admitted.join(', ') + ')',
               admitted.length, inCount >= people.length ? 'All in' : 'Part of the party in',
               byHand ? 'by hand' : 'scanned');

      return { ok: true, status: 'in', ticket: t, name: household,
               party: party, people: state, inCount: inCount,
               admitted: admitted, at: now.getTime(), by: staff.name,
               how: byHand ? 'by hand' : 'scanned', scans: scans };
    }

    logScan_(staff, t, '', '', 'Not on the list', byHand ? 'by hand' : 'scanned');
    return { ok: true, status: 'unknown', ticket: t };
  } finally {
    lock.releaseLock();
  }
}

/** "Ann; Bob" -> { ann: true, bob: true } */
function namesToMap_(value) {
  var map = {};
  var parts = String(value || '').split(';');
  for (var i = 0; i < parts.length; i++) {
    var n = trim_(parts[i]).toLowerCase();
    if (n) map[n] = true;
  }
  return map;
}

/** Back to a list, in the order the people appear on the pass. */
function mapToNames_(people, map) {
  var out = [];
  for (var i = 0; i < people.length; i++) {
    if (map[people[i].name.toLowerCase()]) out.push(people[i].name);
  }
  return out.join('; ');
}

function bumpStaff_(staff, party) {
  try {
    var sh = getStaffSheet_();
    sh.getRange(staff.row, S.USED).setValue(new Date());
    var n = parseInt(sh.getRange(staff.row, S.COUNT).getValue(), 10) || 0;
    sh.getRange(staff.row, S.COUNT).setValue(n + (party || 1));
  } catch (err) {
    console.error('Could not update staff tally: ' + (err && err.message || err));
  }
}


/* ---------- adding volunteers, and trying the whole thing ---------- */

/** Menu: add one person to the gate and show them their code. */
function addCheckInVolunteer__raw() {
  var ui = SpreadsheetApp.getUi();
  var ask = ui.prompt('Add someone to the gate',
    'Their name:', ui.ButtonSet.OK_CANCEL);
  if (ask.getSelectedButton() !== ui.Button.OK) return;

  var name = trim_(ask.getResponseText());
  if (!name) { ui.alert('No name, no code.'); return; }

  var code = newStaffCode_();
  getStaffSheet_().appendRow([name, code, new Date(), '', 0]);

  ui.alert(name + ' can scan.\n\nTheir code is:\n\n    ' + code +
           '\n\nThey open chanukahinhouston.com/checkin on their phone ' +
           'and type it in once. Every code is on the "' + STAFF_NAME + '" tab.');
}

function newStaffCode_() {
  var sh = getStaffSheet_(), last = sh.getLastRow(), taken = {};
  if (last >= 2) {
    var col = sh.getRange(2, S.CODE, last - 1, 1).getValues();
    for (var i = 0; i < col.length; i++) taken[trim_(col[i][0]).toUpperCase()] = true;
  }
  for (var n = 0; n < 50; n++) {
    var c = '';
    for (var i2 = 0; i2 < 6; i2++) {
      c += TICKET_ABC.charAt(Math.floor(Math.random() * TICKET_ABC.length));
    }
    if (!taken[c]) return c;
  }
  throw new Error('Could not find a free staff code');
}

/**
 * Menu: send yourself a pass, so the gate can be tried before anybody
 * has registered. Writes a real row with a real ticket, which can be
 * deleted from the sheet afterwards.
 */
function sendMyselfATestPass__raw() {
  var ui = SpreadsheetApp.getUi();
  var ask = ui.prompt('Try a pass',
    'Send a test pass to which address?', ui.ButtonSet.OK_CANCEL);
  if (ask.getSelectedButton() !== ui.Button.OK) return;

  var to = trim_(ask.getResponseText());
  if (to.indexOf('@') < 0) { ui.alert('That is not an email address.'); return; }

  var sheet = getRegSheet_();
  var ticket = freshTicket_(ticketsInUse_());
  var row = {
    ticket: ticket, first: 'Test', last: 'Pass', phone: '', email: to,
    address: '', city: '', state: '', zip: '', party: 4
  };

  sheet.appendRow([new Date(), ticket, row.first, row.last, '', to,
                   '', '', '', '', row.party,
                   'Sara Test; Mia Test; Avi Test', '', '', '', 0, '', '']);

  var sent = sendPass_(row);
  if (sent) sheet.getRange(sheet.getLastRow(), R.SENT).setValue(sent);

  ui.alert(sent
    ? 'Sent to ' + to + '.\n\nTicket ' + TICKET_TAG + ticket +
      ', four people on it. Scan it, then scan it again -- the second ' +
      'time should tell you it is already in.'
    : 'The row is on the "' + REG_NAME + '" tab with ticket ' +
      TICKET_TAG + ticket + ', but the email would not send. ' +
      'Check Executions for the reason.');
}

/** Menu: read the inbox now rather than waiting for the cycle. */
function readRegistrationsNow() {
  showIntake_(pollRegistrationEmails(true));
}

function showIntake_(r) {
  SpreadsheetApp.getUi().alert(
    'Looked at ' + r.looked + ' conversation' + (r.looked === 1 ? '' : 's') + '.\n\n' +
    'Registrations added: ' + r.added + '\n' +
    'Already in the sheet: ' + r.alreadyHad +
      (r.grew ? '  (' + r.grew + ' grew, new pass sent)' : '') + '\n' +
    'Not registrations (ordinary post): ' + r.notRegistrations + '\n' +
    'Registrations that would not read: ' + r.unreadable +
    (r.unreadable ? '\n\nThose carry the hidden line but it will not parse. ' +
                    'Run "Why is nothing happening?" and send the line it shows.'
                  : ''));
}


/* ==================================================================
   7. WHY IS NOTHING HAPPENING
   ------------------------------------------------------------------
   Runs from the editor or the sheet, needs no dialog, and writes what
   it finds to a 'Door check' tab. Every check is wrapped on its own,
   so one failure reports itself instead of hiding the rest.
   ================================================================== */

function checkTheWiring() {
  var out = [];
  var say = function (what, how) { out.push([what, String(how)]); };

  say('Script version', VERSION);
  say('Checked at', new Date());

  try { say('This script runs as', Session.getEffectiveUser().getEmail()); }
  catch (err) { say('This script runs as', 'could not tell: ' + err); }

  /* --- can it read the inbox at all --- */
  var threads = null;
  try {
    // A sample, not a sweep. Reading a message body is a slow call to
    // Gmail, and an earlier version read every one it could find --
    // which on a busy mailbox simply sat there until Google stopped
    // it after six minutes. Ten threads answers the question.
    threads = GmailApp.search('from:chabadoutreach.org newer_than:14d', 0, 10);
    say('Emails from chabadoutreach.org (newest 10)', threads.length);
  } catch (err) {
    say('READING GMAIL FAILED', err && err.message || err);
    say('What that means', 'The script has never been allowed to read mail. ' +
        'Run this from the sheet menu and accept the permissions.');
  }

  /* --- is the marker in them --- */
  if (threads && threads.length) {
    var withMark = 0, parsed = 0, newest = null, firstFail = '', opened = 0, firstOrg = '';
    var senders = {};
    for (var i = 0; i < threads.length && opened < 8; i++) {
      var msgs = threads[i].getMessages();
      for (var m = 0; m < msgs.length && opened < 8; m++) {
        var html = '';
        try { senders[msgs[m].getFrom()] = true; } catch (e) {}
        try { html = msgs[m].getBody(); opened++; } catch (e) { continue; }
        if (!newest) {
          newest = { subject: msgs[m].getSubject(), when: msgs[m].getDate(),
                     from: msgs[m].getFrom() };
        }
        var isNotify = html.indexOf('Submission Detail') > -1 ||
                       html.indexOf('Form Submission') > -1;
        if (isNotify || html.indexOf(INTAKE_MARK) > -1) {
          withMark++;
          var rt = '';
          try { rt = msgs[m].getReplyTo(); } catch (e3) {}
          var got = isNotify ? parseSubmission_(html, rt)
                             : parseRegistrationEmail_(html);
          if (got) {
            parsed++;
            if (!firstOrg && got.theirEmailWasOurs) firstOrg = got.theirEmailWasOurs;
            if (parsed === 1) {
              say('Read from the newest one',
                  got.first + ' ' + got.last + ', ' + got.party + ' expected, ' + got.email);
            }
          } else if (!firstFail) {
            firstFail = html.slice(html.indexOf(INTAKE_MARK), html.indexOf(INTAKE_MARK) + 220)
                            .replace(/<[^>]*>/g, '');
          }
        }
      }
    }
    if (newest) {
      say('Newest email from them', newest.when + '  —  ' + newest.subject);
      say('Sent by', newest.from);
    }
    say('Messages actually opened', opened);
    say('Of those, readable as registrations', withMark);
    say('Of those, readable', parsed);
    var who = [];
    for (var sKey in senders) if (senders.hasOwnProperty(sKey)) who.push(sKey);
    say('Addresses they came from', who.join('  |  ').slice(0, 300));

    if (parsed && firstOrg) {
      say('THEIR FORM IS SENDING THE WRONG EMAIL',
          'The {Email} tag gives ' + firstOrg + ' -- the office -- not the ' +
          'person who registered. Registrations are still recorded, but no ' +
          'passes can be sent until Chabad points that tag at the registrant.');
    }

    if (!withMark) {
      say('WHAT IS WRONG', 'Their emails arrive but none carry the hidden line. ' +
          'Chabad\'s editor stripped it when you pasted the template, or the ' +
          'test booking was made before you updated it.');
    } else if (!parsed) {
      say('WHAT IS WRONG', 'The line is there but will not read. It is below.');
      say('The line as it arrived', firstFail);
    }
  }

  /* --- can it draw a QR code --- */
  try {
    var drawn = qrTable_('CF26:TESTTEST', 7);
    say('QR code', 'drawn here, ' + drawn.length + ' characters, no outside service');
  } catch (err) {
    say('QR WOULD NOT DRAW', (err && err.message || err) +
        '  (passes still send, with the number printed instead)');
  }

  /* --- can it send --- */
  try { say('Emails left to send today', MailApp.getRemainingDailyQuota()); }
  catch (err) { say('SENDING MAIL FAILED', err && err.message || err); }

  /* --- is anything scheduled --- */
  try {
    var all = ScriptApp.getProjectTriggers(), found = 0;
    for (var t = 0; t < all.length; t++) {
      if (all[t].getHandlerFunction() === 'pollRegistrationEmails') found++;
    }
    say('Reading every 5 minutes', found ? 'yes' : 'NO — use Door > Start reading registrations');
  } catch (err) { say('Could not check the schedule', err && err.message || err); }

  /* --- what is in the sheet --- */
  try {
    var reg = getRegSheet_();
    say('Rows on the Registrations tab', Math.max(0, reg.getLastRow() - 1));
    var st = getStaffSheet_();
    say('Volunteers with a code', Math.max(0, st.getLastRow() - 1));
    var lg = getLogSheet_();
    say('Scans logged', Math.max(0, lg.getLastRow() - 1));
    say('Emails already handled', Math.max(0, getSeenSheet_().getLastRow() - 1));
    try {
      var left = MailApp.getRemainingDailyQuota();
      say('Emails this account may still send today', left +
          (left < 50 ? '   <-- LOW. Passes will wait until this resets' +
                       ' (midnight Pacific / 2am Houston).' : ''));
    } catch (e) {
      say('Emails still available today', 'could not read the quota');
    }
    say('The raffle draws from', DRAW_READS + ' (' + ticketsForDraw_().count + ' tickets)');
  } catch (err) { say('Could not read the tabs', err && err.message || err); }

  writeCheck_(out);
  return out;
}

function writeCheck_(rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Door check');
  if (sh) sh.clear(); else sh = ss.insertSheet('Door check');

  sh.getRange(1, 1, 1, 2).setValues([['Check', 'Result']])
    .setFontWeight('bold').setBackground('#0A1E38').setFontColor('#FFFFFF');
  if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
  sh.setColumnWidth(1, 300);
  sh.setColumnWidth(2, 560);
  sh.setFrozenRows(1);

  try { ss.setActiveSheet(sh); } catch (err) {}
}


/* ==================================================================
   8. THE QR GENERATOR
   ------------------------------------------------------------------
   qrcode-generator 2.0.4 by Kazuhiko Arase, MIT licensed.
   https://github.com/kazuhikoarase/qrcode-generator

   Kept here rather than fetched from a service, so that drawing a
   pass needs no outside server and no network permission. Minified
   because it is somebody else's library and not ours to read.
   ================================================================== */

var qrcode=(function(){var P=function(x,w){var g=236,l=17,n=x,s=O[w],t=null,r=0,h=null,i=[],v={},_=function(a,f){r=n*4+17,t=(function(e){for(var u=new Array(e),o=0;o<e;o+=1){u[o]=new Array(e);for(var d=0;d<e;d+=1)u[o][d]=null}return u})(r),B(0,0),B(r-7,0),B(0,r-7),E(),T(),m(a,f),n>=7&&N(a),h==null&&(h=nr(n,s,i)),U(h,f)},B=function(a,f){for(var e=-1;e<=7;e+=1)if(!(a+e<=-1||r<=a+e))for(var u=-1;u<=7;u+=1)f+u<=-1||r<=f+u||(0<=e&&e<=6&&(u==0||u==6)||0<=u&&u<=6&&(e==0||e==6)||2<=e&&e<=4&&2<=u&&u<=4?t[a+e][f+u]=!0:t[a+e][f+u]=!1)},y=function(){for(var a=0,f=0,e=0;e<8;e+=1){_(!0,e);var u=k.getLostPoint(v);(e==0||a>u)&&(a=u,f=e)}return f},T=function(){for(var a=8;a<r-8;a+=1)t[a][6]==null&&(t[a][6]=a%2==0);for(var f=8;f<r-8;f+=1)t[6][f]==null&&(t[6][f]=f%2==0)},E=function(){for(var a=k.getPatternPosition(n),f=0;f<a.length;f+=1)for(var e=0;e<a.length;e+=1){var u=a[f],o=a[e];if(t[u][o]==null)for(var d=-2;d<=2;d+=1)for(var c=-2;c<=2;c+=1)d==-2||d==2||c==-2||c==2||d==0&&c==0?t[u+d][o+c]=!0:t[u+d][o+c]=!1}},N=function(a){for(var f=k.getBCHTypeNumber(n),e=0;e<18;e+=1){var u=!a&&(f>>e&1)==1;t[Math.floor(e/3)][e%3+r-8-3]=u}for(var e=0;e<18;e+=1){var u=!a&&(f>>e&1)==1;t[e%3+r-8-3][Math.floor(e/3)]=u}},m=function(a,f){for(var e=s<<3|f,u=k.getBCHTypeInfo(e),o=0;o<15;o+=1){var d=!a&&(u>>o&1)==1;o<6?t[o][8]=d:o<8?t[o+1][8]=d:t[r-15+o][8]=d}for(var o=0;o<15;o+=1){var d=!a&&(u>>o&1)==1;o<8?t[8][r-o-1]=d:o<9?t[8][15-o-1+1]=d:t[8][15-o-1]=d}t[r-8][8]=!a},U=function(a,f){for(var e=-1,u=r-1,o=7,d=0,c=k.getMaskFunction(f),p=r-1;p>0;p-=2)for(p==6&&(p-=1);;){for(var b=0;b<2;b+=1)if(t[u][p-b]==null){var C=!1;d<a.length&&(C=(a[d]>>>o&1)==1);var A=c(u,p-b);A&&(C=!C),t[u][p-b]=C,o-=1,o==-1&&(d+=1,o=7)}if(u+=e,u<0||r<=u){u-=e,e=-e;break}}},H=function(a,f){for(var e=0,u=0,o=0,d=new Array(f.length),c=new Array(f.length),p=0;p<f.length;p+=1){var b=f[p].dataCount,C=f[p].totalCount-b;u=Math.max(u,b),o=Math.max(o,C),d[p]=new Array(b);for(var A=0;A<d[p].length;A+=1)d[p][A]=255&a.getBuffer()[A+e];e+=b;var R=k.getErrorCorrectPolynomial(C),I=K(d[p],R.getLength()-1),S=I.mod(R);c[p]=new Array(R.getLength()-1);for(var A=0;A<c[p].length;A+=1){var X=A+S.getLength()-c[p].length;c[p][A]=X>=0?S.getAt(X):0}}for(var Z=0,A=0;A<f.length;A+=1)Z+=f[A].totalCount;for(var J=new Array(Z),Q=0,A=0;A<u;A+=1)for(var p=0;p<f.length;p+=1)A<d[p].length&&(J[Q]=d[p][A],Q+=1);for(var A=0;A<o;A+=1)for(var p=0;p<f.length;p+=1)A<c[p].length&&(J[Q]=c[p][A],Q+=1);return J},nr=function(a,f,e){for(var u=Y.getRSBlocks(a,f),o=G(),d=0;d<e.length;d+=1){var c=e[d];o.put(c.getMode(),4),o.put(c.getLength(),k.getLengthInBits(c.getMode(),a)),c.write(o)}for(var p=0,d=0;d<u.length;d+=1)p+=u[d].dataCount;if(o.getLengthInBits()>p*8)throw"code length overflow. ("+o.getLengthInBits()+">"+p*8+")";for(o.getLengthInBits()+4<=p*8&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=p*8||(o.put(g,8),o.getLengthInBits()>=p*8));)o.put(l,8);return H(o,u)};v.addData=function(a,f){f=f||"Byte";var e=null;switch(f){case"Numeric":e=$(a);break;case"Alphanumeric":e=W(a);break;case"Byte":e=V(a);break;case"Kanji":e=q(a);break;default:throw"mode:"+f}i.push(e),h=null},v.isDark=function(a,f){if(a<0||r<=a||f<0||r<=f)throw a+","+f;return t[a][f]},v.getModuleCount=function(){return r},v.make=function(){if(n<1){for(var a=1;a<40;a++){for(var f=Y.getRSBlocks(a,s),e=G(),u=0;u<i.length;u++){var o=i[u];e.put(o.getMode(),4),e.put(o.getLength(),k.getLengthInBits(o.getMode(),a)),o.write(e)}for(var d=0,u=0;u<f.length;u++)d+=f[u].dataCount;if(e.getLengthInBits()<=d*8)break}n=a}_(!1,y())},v.createTableTag=function(a,f){a=a||2,f=typeof f>"u"?a*4:f;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+f+"px;",e+='">',e+="<tbody>";for(var u=0;u<v.getModuleCount();u+=1){e+="<tr>";for(var o=0;o<v.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+a+"px;",e+=" height: "+a+"px;",e+=" background-color: ",e+=v.isDark(u,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>",e},v.createSvgTag=function(a,f,e,u){var o={};typeof arguments[0]=="object"&&(o=arguments[0],a=o.cellSize,f=o.margin,e=o.alt,u=o.title),a=a||2,f=typeof f>"u"?a*4:f,e=typeof e=="string"?{text:e}:e||{},e.text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,u=typeof u=="string"?{text:u}:u||{},u.text=u.text||null,u.id=u.text?u.id||"qrcode-title":null;var d=v.getModuleCount()*a+f*2,c,p,b,C,A="",R;for(R="l"+a+",0 0,"+a+" -"+a+",0 0,-"+a+"z ",A+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',A+=o.scalable?"":' width="'+d+'px" height="'+d+'px"',A+=' viewBox="0 0 '+d+" "+d+'" ',A+=' preserveAspectRatio="xMinYMin meet"',A+=u.text||e.text?' role="img" aria-labelledby="'+F([u.id,e.id].join(" ").trim())+'"':"",A+=">",A+=u.text?'<title id="'+F(u.id)+'">'+F(u.text)+"</title>":"",A+=e.text?'<description id="'+F(e.id)+'">'+F(e.text)+"</description>":"",A+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',A+='<path d="',b=0;b<v.getModuleCount();b+=1)for(C=b*a+f,c=0;c<v.getModuleCount();c+=1)v.isDark(b,c)&&(p=c*a+f,A+="M"+p+","+C+R);return A+='" stroke="transparent" fill="black"/>',A+="</svg>",A},v.createDataURL=function(a,f){a=a||2,f=typeof f>"u"?a*4:f;var e=v.getModuleCount()*a+f*2,u=f,o=e-f;return er(e,e,function(d,c){if(u<=d&&d<o&&u<=c&&c<o){var p=Math.floor((d-u)/a),b=Math.floor((c-u)/a);return v.isDark(b,p)?0:1}else return 1})},v.createImgTag=function(a,f,e){a=a||2,f=typeof f>"u"?a*4:f;var u=v.getModuleCount()*a+f*2,o="";return o+="<img",o+=' src="',o+=v.createDataURL(a,f),o+='"',o+=' width="',o+=u,o+='"',o+=' height="',o+=u,o+='"',e&&(o+=' alt="',o+=F(e),o+='"'),o+="/>",o};var F=function(a){for(var f="",e=0;e<a.length;e+=1){var u=a.charAt(e);switch(u){case"<":f+="&lt;";break;case">":f+="&gt;";break;case"&":f+="&amp;";break;case'"':f+="&quot;";break;default:f+=u;break}}return f},ar=function(a){var f=1;a=typeof a>"u"?f*2:a;var e=v.getModuleCount()*f+a*2,u=a,o=e-a,d,c,p,b,C,A={"\u2588\u2588":"\u2588","\u2588 ":"\u2580"," \u2588":"\u2584","  ":" "},R={"\u2588\u2588":"\u2580","\u2588 ":"\u2580"," \u2588":" ","  ":" "},I="";for(d=0;d<e;d+=2){for(p=Math.floor((d-u)/f),b=Math.floor((d+1-u)/f),c=0;c<e;c+=1)C="\u2588",u<=c&&c<o&&u<=d&&d<o&&v.isDark(p,Math.floor((c-u)/f))&&(C=" "),u<=c&&c<o&&u<=d+1&&d+1<o&&v.isDark(b,Math.floor((c-u)/f))?C+=" ":C+="\u2588",I+=a<1&&d+1>=o?R[C]:A[C];I+=`
`}return e%2&&a>0?I.substring(0,I.length-e-1)+Array(e+1).join("\u2580"):I.substring(0,I.length-1)};return v.createASCII=function(a,f){if(a=a||1,a<2)return ar(f);a-=1,f=typeof f>"u"?a*2:f;var e=v.getModuleCount()*a+f*2,u=f,o=e-f,d,c,p,b,C=Array(a+1).join("\u2588\u2588"),A=Array(a+1).join("  "),R="",I="";for(d=0;d<e;d+=1){for(p=Math.floor((d-u)/a),I="",c=0;c<e;c+=1)b=1,u<=c&&c<o&&u<=d&&d<o&&v.isDark(p,Math.floor((c-u)/a))&&(b=0),I+=b?C:A;for(p=0;p<a;p+=1)R+=I+`
`}return R.substring(0,R.length-1)},v.renderTo2dContext=function(a,f){f=f||2;for(var e=v.getModuleCount(),u=0;u<e;u++)for(var o=0;o<e;o++)a.fillStyle=v.isDark(u,o)?"black":"white",a.fillRect(o*f,u*f,f,f)},v};P.stringToBytesFuncs={default:function(x){for(var w=[],g=0;g<x.length;g+=1){var l=x.charCodeAt(g);w.push(l&255)}return w}},P.stringToBytes=P.stringToBytesFuncs.default,P.createStringToBytes=function(x,w){var g=(function(){for(var n=rr(x),s=function(){var T=n.read();if(T==-1)throw"eof";return T},t=0,r={};;){var h=n.read();if(h==-1)break;var i=s(),v=s(),_=s(),B=String.fromCharCode(h<<8|i),y=v<<8|_;r[B]=y,t+=1}if(t!=w)throw t+" != "+w;return r})(),l=63;return function(n){for(var s=[],t=0;t<n.length;t+=1){var r=n.charCodeAt(t);if(r<128)s.push(r);else{var h=g[n.charAt(t)];typeof h=="number"?(h&255)==h?s.push(h):(s.push(h>>>8),s.push(h&255)):s.push(l)}}return s}};var D={MODE_NUMBER:1,MODE_ALPHA_NUM:2,MODE_8BIT_BYTE:4,MODE_KANJI:8},O={L:1,M:0,Q:3,H:2},L={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7},k=(function(){var x=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],w=1335,g=7973,l=21522,n={},s=function(t){for(var r=0;t!=0;)r+=1,t>>>=1;return r};return n.getBCHTypeInfo=function(t){for(var r=t<<10;s(r)-s(w)>=0;)r^=w<<s(r)-s(w);return(t<<10|r)^l},n.getBCHTypeNumber=function(t){for(var r=t<<12;s(r)-s(g)>=0;)r^=g<<s(r)-s(g);return t<<12|r},n.getPatternPosition=function(t){return x[t-1]},n.getMaskFunction=function(t){switch(t){case L.PATTERN000:return function(r,h){return(r+h)%2==0};case L.PATTERN001:return function(r,h){return r%2==0};case L.PATTERN010:return function(r,h){return h%3==0};case L.PATTERN011:return function(r,h){return(r+h)%3==0};case L.PATTERN100:return function(r,h){return(Math.floor(r/2)+Math.floor(h/3))%2==0};case L.PATTERN101:return function(r,h){return r*h%2+r*h%3==0};case L.PATTERN110:return function(r,h){return(r*h%2+r*h%3)%2==0};case L.PATTERN111:return function(r,h){return(r*h%3+(r+h)%2)%2==0};default:throw"bad maskPattern:"+t}},n.getErrorCorrectPolynomial=function(t){for(var r=K([1],0),h=0;h<t;h+=1)r=r.multiply(K([1,M.gexp(h)],0));return r},n.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case D.MODE_NUMBER:return 10;case D.MODE_ALPHA_NUM:return 9;case D.MODE_8BIT_BYTE:return 8;case D.MODE_KANJI:return 8;default:throw"mode:"+t}else if(r<27)switch(t){case D.MODE_NUMBER:return 12;case D.MODE_ALPHA_NUM:return 11;case D.MODE_8BIT_BYTE:return 16;case D.MODE_KANJI:return 10;default:throw"mode:"+t}else if(r<41)switch(t){case D.MODE_NUMBER:return 14;case D.MODE_ALPHA_NUM:return 13;case D.MODE_8BIT_BYTE:return 16;case D.MODE_KANJI:return 12;default:throw"mode:"+t}else throw"type:"+r},n.getLostPoint=function(t){for(var r=t.getModuleCount(),h=0,i=0;i<r;i+=1)for(var v=0;v<r;v+=1){for(var _=0,B=t.isDark(i,v),y=-1;y<=1;y+=1)if(!(i+y<0||r<=i+y))for(var T=-1;T<=1;T+=1)v+T<0||r<=v+T||y==0&&T==0||B==t.isDark(i+y,v+T)&&(_+=1);_>5&&(h+=3+_-5)}for(var i=0;i<r-1;i+=1)for(var v=0;v<r-1;v+=1){var E=0;t.isDark(i,v)&&(E+=1),t.isDark(i+1,v)&&(E+=1),t.isDark(i,v+1)&&(E+=1),t.isDark(i+1,v+1)&&(E+=1),(E==0||E==4)&&(h+=3)}for(var i=0;i<r;i+=1)for(var v=0;v<r-6;v+=1)t.isDark(i,v)&&!t.isDark(i,v+1)&&t.isDark(i,v+2)&&t.isDark(i,v+3)&&t.isDark(i,v+4)&&!t.isDark(i,v+5)&&t.isDark(i,v+6)&&(h+=40);for(var v=0;v<r;v+=1)for(var i=0;i<r-6;i+=1)t.isDark(i,v)&&!t.isDark(i+1,v)&&t.isDark(i+2,v)&&t.isDark(i+3,v)&&t.isDark(i+4,v)&&!t.isDark(i+5,v)&&t.isDark(i+6,v)&&(h+=40);for(var N=0,v=0;v<r;v+=1)for(var i=0;i<r;i+=1)t.isDark(i,v)&&(N+=1);var m=Math.abs(100*N/r/r-50)/5;return h+=m*10,h},n})(),M=(function(){for(var x=new Array(256),w=new Array(256),g=0;g<8;g+=1)x[g]=1<<g;for(var g=8;g<256;g+=1)x[g]=x[g-4]^x[g-5]^x[g-6]^x[g-8];for(var g=0;g<255;g+=1)w[x[g]]=g;var l={};return l.glog=function(n){if(n<1)throw"glog("+n+")";return w[n]},l.gexp=function(n){for(;n<0;)n+=255;for(;n>=256;)n-=255;return x[n]},l})();function K(x,w){if(typeof x.length>"u")throw x.length+"/"+w;var g=(function(){for(var n=0;n<x.length&&x[n]==0;)n+=1;for(var s=new Array(x.length-n+w),t=0;t<x.length-n;t+=1)s[t]=x[t+n];return s})(),l={};return l.getAt=function(n){return g[n]},l.getLength=function(){return g.length},l.multiply=function(n){for(var s=new Array(l.getLength()+n.getLength()-1),t=0;t<l.getLength();t+=1)for(var r=0;r<n.getLength();r+=1)s[t+r]^=M.gexp(M.glog(l.getAt(t))+M.glog(n.getAt(r)));return K(s,0)},l.mod=function(n){if(l.getLength()-n.getLength()<0)return l;for(var s=M.glog(l.getAt(0))-M.glog(n.getAt(0)),t=new Array(l.getLength()),r=0;r<l.getLength();r+=1)t[r]=l.getAt(r);for(var r=0;r<n.getLength();r+=1)t[r]^=M.gexp(M.glog(n.getAt(r))+s);return K(t,0).mod(n)},l}var Y=(function(){var x=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],w=function(n,s){var t={};return t.totalCount=n,t.dataCount=s,t},g={},l=function(n,s){switch(s){case O.L:return x[(n-1)*4+0];case O.M:return x[(n-1)*4+1];case O.Q:return x[(n-1)*4+2];case O.H:return x[(n-1)*4+3];default:return}};return g.getRSBlocks=function(n,s){var t=l(n,s);if(typeof t>"u")throw"bad rs block @ typeNumber:"+n+"/errorCorrectionLevel:"+s;for(var r=t.length/3,h=[],i=0;i<r;i+=1)for(var v=t[i*3+0],_=t[i*3+1],B=t[i*3+2],y=0;y<v;y+=1)h.push(w(_,B));return h},g})(),G=function(){var x=[],w=0,g={};return g.getBuffer=function(){return x},g.getAt=function(l){var n=Math.floor(l/8);return(x[n]>>>7-l%8&1)==1},g.put=function(l,n){for(var s=0;s<n;s+=1)g.putBit((l>>>n-s-1&1)==1)},g.getLengthInBits=function(){return w},g.putBit=function(l){var n=Math.floor(w/8);x.length<=n&&x.push(0),l&&(x[n]|=128>>>w%8),w+=1},g},$=function(x){var w=D.MODE_NUMBER,g=x,l={};l.getMode=function(){return w},l.getLength=function(t){return g.length},l.write=function(t){for(var r=g,h=0;h+2<r.length;)t.put(n(r.substring(h,h+3)),10),h+=3;h<r.length&&(r.length-h==1?t.put(n(r.substring(h,h+1)),4):r.length-h==2&&t.put(n(r.substring(h,h+2)),7))};var n=function(t){for(var r=0,h=0;h<t.length;h+=1)r=r*10+s(t.charAt(h));return r},s=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-48;throw"illegal char :"+t};return l},W=function(x){var w=D.MODE_ALPHA_NUM,g=x,l={};l.getMode=function(){return w},l.getLength=function(s){return g.length},l.write=function(s){for(var t=g,r=0;r+1<t.length;)s.put(n(t.charAt(r))*45+n(t.charAt(r+1)),11),r+=2;r<t.length&&s.put(n(t.charAt(r)),6)};var n=function(s){if("0"<=s&&s<="9")return s.charCodeAt(0)-48;if("A"<=s&&s<="Z")return s.charCodeAt(0)-65+10;switch(s){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+s}};return l},V=function(x){var w=D.MODE_8BIT_BYTE,g=x,l=P.stringToBytes(x),n={};return n.getMode=function(){return w},n.getLength=function(s){return l.length},n.write=function(s){for(var t=0;t<l.length;t+=1)s.put(l[t],8)},n},q=function(x){var w=D.MODE_KANJI,g=x,l=P.stringToBytesFuncs.SJIS;if(!l)throw"sjis not supported.";(function(t,r){var h=l(t);if(h.length!=2||(h[0]<<8|h[1])!=r)throw"sjis not supported."})("\u53CB",38726);var n=l(x),s={};return s.getMode=function(){return w},s.getLength=function(t){return~~(n.length/2)},s.write=function(t){for(var r=n,h=0;h+1<r.length;){var i=(255&r[h])<<8|255&r[h+1];if(33088<=i&&i<=40956)i-=33088;else if(57408<=i&&i<=60351)i-=49472;else throw"illegal char at "+(h+1)+"/"+i;i=(i>>>8&255)*192+(i&255),t.put(i,13),h+=2}if(h<r.length)throw"illegal char at "+(h+1)},s},j=function(){var x=[],w={};return w.writeByte=function(g){x.push(g&255)},w.writeShort=function(g){w.writeByte(g),w.writeByte(g>>>8)},w.writeBytes=function(g,l,n){l=l||0,n=n||g.length;for(var s=0;s<n;s+=1)w.writeByte(g[s+l])},w.writeString=function(g){for(var l=0;l<g.length;l+=1)w.writeByte(g.charCodeAt(l))},w.toByteArray=function(){return x},w.toString=function(){var g="";g+="[";for(var l=0;l<x.length;l+=1)l>0&&(g+=","),g+=x[l];return g+="]",g},w},z=function(){var x=0,w=0,g=0,l="",n={},s=function(r){l+=String.fromCharCode(t(r&63))},t=function(r){if(!(r<0)){if(r<26)return 65+r;if(r<52)return 97+(r-26);if(r<62)return 48+(r-52);if(r==62)return 43;if(r==63)return 47}throw"n:"+r};return n.writeByte=function(r){for(x=x<<8|r&255,w+=8,g+=1;w>=6;)s(x>>>w-6),w-=6},n.flush=function(){if(w>0&&(s(x<<6-w),x=0,w=0),g%3!=0)for(var r=3-g%3,h=0;h<r;h+=1)l+="="},n.toString=function(){return l},n},rr=function(x){var w=x,g=0,l=0,n=0,s={};s.read=function(){for(;n<8;){if(g>=w.length){if(n==0)return-1;throw"unexpected end of file./"+n}var r=w.charAt(g);if(g+=1,r=="=")return n=0,-1;if(r.match(/^\s$/))continue;l=l<<6|t(r.charCodeAt(0)),n+=6}var h=l>>>n-8&255;return n-=8,h};var t=function(r){if(65<=r&&r<=90)return r-65;if(97<=r&&r<=122)return r-97+26;if(48<=r&&r<=57)return r-48+52;if(r==43)return 62;if(r==47)return 63;throw"c:"+r};return s},tr=function(x,w){var g=x,l=w,n=new Array(x*w),s={};s.setPixel=function(i,v,_){n[v*g+i]=_},s.write=function(i){i.writeString("GIF87a"),i.writeShort(g),i.writeShort(l),i.writeByte(128),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(255),i.writeByte(255),i.writeByte(255),i.writeString(","),i.writeShort(0),i.writeShort(0),i.writeShort(g),i.writeShort(l),i.writeByte(0);var v=2,_=r(v);i.writeByte(v);for(var B=0;_.length-B>255;)i.writeByte(255),i.writeBytes(_,B,255),B+=255;i.writeByte(_.length-B),i.writeBytes(_,B,_.length-B),i.writeByte(0),i.writeString(";")};var t=function(i){var v=i,_=0,B=0,y={};return y.write=function(T,E){if(T>>>E)throw"length over";for(;_+E>=8;)v.writeByte(255&(T<<_|B)),E-=8-_,T>>>=8-_,B=0,_=0;B=T<<_|B,_=_+E},y.flush=function(){_>0&&v.writeByte(B)},y},r=function(i){for(var v=1<<i,_=(1<<i)+1,B=i+1,y=h(),T=0;T<v;T+=1)y.add(String.fromCharCode(T));y.add(String.fromCharCode(v)),y.add(String.fromCharCode(_));var E=j(),N=t(E);N.write(v,B);var m=0,U=String.fromCharCode(n[m]);for(m+=1;m<n.length;){var H=String.fromCharCode(n[m]);m+=1,y.contains(U+H)?U=U+H:(N.write(y.indexOf(U),B),y.size()<4095&&(y.size()==1<<B&&(B+=1),y.add(U+H)),U=H)}return N.write(y.indexOf(U),B),N.write(_,B),N.flush(),E.toByteArray()},h=function(){var i={},v=0,_={};return _.add=function(B){if(_.contains(B))throw"dup key:"+B;i[B]=v,v+=1},_.size=function(){return v},_.indexOf=function(B){return i[B]},_.contains=function(B){return typeof i[B]<"u"},_};return s},er=function(x,w,g){for(var l=tr(x,w),n=0;n<w;n+=1)for(var s=0;s<x;s+=1)l.setPixel(s,n,g(s,n));var t=j();l.write(t);for(var r=z(),h=t.toByteArray(),i=0;i<h.length;i+=1)r.writeByte(h[i]);return r.flush(),"data:image/gif;base64,"+r};return P})();(function(){qrcode.stringToBytesFuncs["UTF-8"]=function(P){function D(O){for(var L=[],k=0;k<O.length;k++){var M=O.charCodeAt(k);M<128?L.push(M):M<2048?L.push(192|M>>6,128|M&63):M<55296||M>=57344?L.push(224|M>>12,128|M>>6&63,128|M&63):(k++,M=65536+((M&1023)<<10|O.charCodeAt(k)&1023),L.push(240|M>>18,128|M>>12&63,128|M>>6&63,128|M&63))}return L}return D(P)}})(),(function(P){typeof define=="function"&&define.amd?define([],P):typeof exports=="object"&&(module.exports=P())})(function(){return qrcode});


/**
 * Read everything again, including anything already marked as done.
 *
 * The intake marks a conversation once it has looked at it, so the
 * same registration is never entered twice. Which is right until a
 * run marks something and then fails to write the row -- after that
 * the mark is a lie, and nothing will ever look at that email again.
 *
 * This takes the marks off and starts over. Safe to run: a household
 * already in the sheet is recognised by phone or email and skipped,
 * so nobody ends up registered twice or sent a second pass.
 */
function readEverythingAgain() {
  var ui = SpreadsheetApp.getUi();

  var seenSheet = getSeenSheet_();
  var seenRows = Math.max(0, seenSheet.getLastRow() - 1);
  if (seenRows > 0) seenSheet.deleteRows(2, seenRows);

  var label = GmailApp.getUserLabelByName(INTAKE_LABEL);
  var cleared = seenRows;

  if (label) {
    // in batches: a label can be on more threads than one call returns
    for (var pass = 0; pass < 20; pass++) {
      var marked = label.getThreads(0, 100);
      if (!marked.length) break;
      for (var i = 0; i < marked.length; i++) {
        marked[i].removeLabel(label);
        cleared++;
      }
      if (marked.length < 100) break;
    }
  }

  var r = pollRegistrationEmails(true);
  ui.alert('Started over.\n\n' +
           'Marks cleared: ' + cleared + '\n' +
           'Registrations added: ' + r.added + '\n' +
           'Already in the sheet: ' + r.alreadyHad +
             (r.grew ? '  (' + r.grew + ' grew, new pass sent)' : '') + '\n' +
           'Not registrations (ordinary post): ' + r.notRegistrations + '\n' +
           'Registrations that would not read: ' + r.unreadable);
}


/**
 * Re-read the guest names on every registration already in the sheet.
 *
 * An earlier version of the name scraper swept up field labels --
 * "First Name", "Zip", "Expiration Month" -- and wrote them into the
 * Guests column, where the gate then read them out. This goes back
 * to the emails and rewrites that column properly.
 *
 * Touches nothing else: no tickets change, no passes are sent.
 */
function tidyGuestNames__raw() {
  var ui = SpreadsheetApp.getUi();
  var sheet = getRegSheet_();
  var last = sheet.getLastRow();
  if (last < 2) { ui.alert('No registrations yet.'); return; }

  var rows = sheet.getRange(2, 1, last - 1, REG_HEADERS.length).getValues();
  var byPhone = {}, byEmail = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = digits_(rows[i][R.PHONE - 1]);
    var em = trim_(rows[i][R.EMAIL - 1]).toLowerCase();
    if (ph) byPhone[ph] = i + 2;
    if (em) byEmail[em] = i + 2;
  }

  var threads = GmailApp.search(INTAKE_QUERY, 0, 50);
  var fixed = 0, looked = 0;

  for (var t = 0; t < threads.length; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length; m++) {
      var html;
      try { html = msgs[m].getBody(); } catch (e) { continue; }

      var rt = '';
      try { rt = msgs[m].getReplyTo(); } catch (e2) {}

      var parsed = parseSubmission_(html, rt) || parseRegistrationEmail_(html);
      if (!parsed) continue;
      looked++;

      var row = byPhone[digits_(parsed.phone)] ||
                byEmail[trim_(parsed.email).toLowerCase()];
      if (!row) continue;

      var names = namesFrom_(html);
      if (!names) continue;
      if (names === trim_(sheet.getRange(row, R.GUESTS).getValue())) continue;

      sheet.getRange(row, R.GUESTS).setValue(names);
      fixed++;
    }
  }

  ui.alert('Guest names tidied.\n\n' +
           'Registrations found in the inbox: ' + looked + '\n' +
           'Rows rewritten: ' + fixed + '\n\n' +
           'No tickets changed and no passes were sent. The volunteers\' ' +
           'phones pick this up next time they tap Refresh.');
}


/**
 * Wipe the test registrations and start clean.
 *
 * Empties the Registrations tab and the door log, then marks every
 * registration email already in the inbox as handled -- so the next
 * run picks up only what arrives from now on, rather than importing
 * the whole morning's testing again.
 *
 * Deliberately leaves the volunteers and their codes alone: having
 * to set those up again after every test run would be its own
 * small misery.
 */
function startTestingOver__raw() {
  var ui = SpreadsheetApp.getUi();

  var reg = getRegSheet_();
  var log = getLogSheet_();
  var regRows = Math.max(0, reg.getLastRow() - 1);
  var logRows = Math.max(0, log.getLastRow() - 1);

  var sure = ui.alert(
    'Start the testing over?',
    'This deletes:\n\n' +
    '  ' + regRows + ' row(s) on "' + REG_NAME + '"\n' +
    '  ' + logRows + ' row(s) on "' + LOG_NAME + '"\n\n' +
    'and marks every registration email already in the inbox as ' +
    'handled, so only new ones come in from here.\n\n' +
    'Volunteers and their codes are kept. Passes already emailed ' +
    'cannot be unsent -- those tickets simply will not be on the ' +
    'list any more.\n\nThis cannot be undone.',
    ui.ButtonSet.YES_NO);
  if (sure !== ui.Button.YES) return;

  if (regRows > 0) reg.deleteRows(2, regRows);
  if (logRows > 0) log.deleteRows(2, logRows);

  // Everything currently in the inbox counts as already dealt with.
  var label = GmailApp.getUserLabelByName(INTAKE_LABEL) ||
              GmailApp.createLabel(INTAKE_LABEL);

  seedHandledFromOldLabel_();

  var seenSheet = getSeenSheet_();
  var seen = messagesAlreadyHandled_();
  var rows = [], marked = 0;

  var threads = GmailApp.search(INTAKE_QUERY, 0, 200);
  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var m = 0; m < msgs.length; m++) {
      var id = '';
      try { id = msgs[m].getId(); } catch (e) { continue; }
      if (!id || seen[id]) continue;
      seen[id] = true;
      rows.push([id, new Date(), 'Skipped: testing restarted']);
      marked++;
    }
    try { threads[i].addLabel(label); } catch (e2) {}
  }
  if (rows.length) {
    seenSheet.getRange(seenSheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
  }

  ui.alert('Clean slate.\n\n' +
           'Registrations cleared: ' + regRows + '\n' +
           'Door log cleared: ' + logRows + '\n' +
           'Old emails marked as handled: ' + marked + '\n\n' +
           'Register again and it should come through within a minute. ' +
           'On the scanner, tap Refresh to pull the empty list.');
}


/**
 * Bring the people who used the old website form across.
 *
 * They registered before the site moved to Chabad's form, so they
 * sit on the Entries tab with no ticket, no pass, and no place on
 * the gate's list. Left there they would reach the barrier on the
 * night with nothing to scan.
 *
 * Reads that tab rather than anything retyped, so nobody's phone
 * number or surname is mistranscribed on the way over. Safe to run
 * twice: anyone already registered is recognised and skipped.
 *
 * Ages go. The old form asked for them and nothing uses them now.
 */
function bringOverOldEntries__raw() {
  var ui = SpreadsheetApp.getUi();
  var from = getSheet_();
  var last = from.getLastRow();
  if (last < 2) { ui.alert('The "' + SHEET_NAME + '" tab is empty.'); return; }

  var rows = from.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var sheet = getRegSheet_();

  // what is actually there to do, before asking
  var todo = [];
  for (var i = 0; i < rows.length; i++) {
    var first = trim_(rows[i][C.FIRST - 1]);
    var surname = trim_(rows[i][C.LAST - 1]);
    if (!first && !surname) continue;                 // blank row

    var email = trim_(rows[i][C.EMAIL - 1]).toLowerCase();
    var phone = digits_(rows[i][C.PHONE - 1]);
    if (findRegistration_(sheet, phone, email, surname)) continue;   // already across

    todo.push({
      when:  rows[i][C.TIME - 1] || new Date(),
      first: first, last: surname, phone: phone, email: email,
      address: trim_(rows[i][C.ADDRESS - 1]),
      party: parseInt(rows[i][C.PARTY - 1], 10) || 1,
      guests: withoutAges_(rows[i][C.FAMILY - 1])
    });
  }

  if (!todo.length) { ui.alert('Nothing to bring over - everyone on "' +
                               SHEET_NAME + '" is already registered.'); return; }

  var withEmail = 0;
  for (var e = 0; e < todo.length; e++) if (todo[e].email) withEmail++;

  var sure = ui.alert(
    'Bring over ' + todo.length + ' registration' + (todo.length === 1 ? '' : 's') + '?',
    todo.length + ' household(s) from "' + SHEET_NAME + '" will be given a ticket ' +
    'and added to "' + REG_NAME + '".\n\n' +
    withEmail + ' of them will be emailed their pass now.\n\n' +
    'Anyone already registered is skipped, so this is safe to run again.',
    ui.ButtonSet.YES_NO);
  if (sure !== ui.Button.YES) return;

  var taken = ticketsInUse_();
  var added = 0, mailed = 0, noAddress = 0;

  for (var t = 0; t < todo.length; t++) {
    var it = todo[t];
    var ticket = freshTicket_(taken);
    taken[ticket] = true;

    sheet.appendRow([
      it.when, ticket, it.first, it.last, it.phone, it.email,
      it.address, '', '', '', it.party, it.guests,
      '', '', '', 0, '', ''
    ]);
    added++;

    if (!it.email) { noAddress++; continue; }

    var sent = sendPass_({
      ticket: ticket, first: it.first, last: it.last,
      email: it.email, party: it.party, guests: it.guests
    });
    if (sent) { sheet.getRange(sheet.getLastRow(), R.SENT).setValue(sent); mailed++; }
  }

  ui.alert('Brought over.\n\n' +
           'Registrations added: ' + added + '\n' +
           'Passes emailed: ' + mailed +
           (noAddress ? '\nNo email on file: ' + noAddress +
                        ' (they are on the list, and the gate can find them by name)' : '') +
           '\n\nThe "' + SHEET_NAME + '" tab is untouched.');
}

/** "Mia Klein (7); Avi Klein (4)" -> "Mia Klein; Avi Klein" */
function withoutAges_(value) {
  var parts = String(value || '').split(';');
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var n = trim_(parts[i]).replace(/\s*\(\s*\d+\s*\)\s*$/, '').trim();
    if (n) out.push(n);
  }
  return out.join('; ');
}


/**
 * Send somebody their pass again.
 *
 * Deleted emails, changed phones, a pass that went to a typo'd
 * address: all of it happens, and the answer should not be asking
 * the office to rebuild a row by hand.
 *
 * Finds them by whatever is to hand -- a name, the ticket number,
 * an email address, a phone number -- and insists on exactly one
 * match before sending anything, because sending the Bettouns'
 * pass to the Brachs is worse than not sending it at all.
 */
function sendSomeonesPassAgain__raw() {
  var ui = SpreadsheetApp.getUi();
  var ask = ui.prompt('Send a pass again',
    'Name, ticket number, email address or phone number:',
    ui.ButtonSet.OK_CANCEL);
  if (ask.getSelectedButton() !== ui.Button.OK) return;

  var needle = trim_(ask.getResponseText()).toLowerCase();
  if (needle.length < 3) { ui.alert('Give me a bit more to go on.'); return; }

  var sheet = getRegSheet_();
  var last = sheet.getLastRow();
  if (last < 2) { ui.alert('Nobody is registered yet.'); return; }

  var rows = sheet.getRange(2, 1, last - 1, REG_HEADERS.length).getValues();
  var digitsOnly = digits_(needle);
  var hits = [];

  for (var i = 0; i < rows.length; i++) {
    var name   = fullName_(rows[i][R.FIRST - 1], rows[i][R.LAST - 1]).toLowerCase();
    var ticket = trim_(rows[i][R.TICKET - 1]).toLowerCase();
    var email  = trim_(rows[i][R.EMAIL - 1]).toLowerCase();
    var phone  = digits_(rows[i][R.PHONE - 1]);
    var guests = trim_(rows[i][R.GUESTS - 1]).toLowerCase();

    var match = (name && name.indexOf(needle) > -1) ||
                (ticket && ticket === needle.replace('cf26:', '')) ||
                (email && email.indexOf(needle) > -1) ||
                (guests && guests.indexOf(needle) > -1) ||
                (digitsOnly.length >= 7 && phone && phone.indexOf(digitsOnly) > -1);

    if (match) hits.push({ row: i + 2, data: rows[i] });
  }

  if (!hits.length) {
    ui.alert('Nobody found for "' + ask.getResponseText() + '".\n\n' +
             'Try a surname, or the ticket number from their pass.');
    return;
  }

  if (hits.length > 1) {
    var who = [];
    for (var h = 0; h < hits.length && h < 12; h++) {
      who.push('  ' + fullName_(hits[h].data[R.FIRST - 1], hits[h].data[R.LAST - 1]) +
               '  -  ' + TICKET_TAG + trim_(hits[h].data[R.TICKET - 1]) +
               (trim_(hits[h].data[R.EMAIL - 1]) ? '  -  ' + trim_(hits[h].data[R.EMAIL - 1]) : ''));
    }
    ui.alert(hits.length + ' people match that.\n\n' + who.join('\n') +
             (hits.length > 12 ? '\n  ...' : '') +
             '\n\nRun it again with the ticket number, so the right one goes out.');
    return;
  }

  var hit = hits[0], d = hit.data;
  var name = fullName_(d[R.FIRST - 1], d[R.LAST - 1]);
  var ticket = trim_(d[R.TICKET - 1]);
  var email = trim_(d[R.EMAIL - 1]);

  if (!email) {
    ui.alert('No email address on file for ' + name + '.\n\n' +
             'Their ticket is ' + TICKET_TAG + ticket + ' - read it to them, or ' +
             'put an address in the Email column and run this again.\n\n' +
             'The gate can also find them by name without a pass.');
    return;
  }

  var sure = ui.alert('Send it again?',
    name + '\n' + TICKET_TAG + ticket + '\n' + email + '\n' +
    (parseInt(d[R.PARTY - 1], 10) || 1) + ' people on this pass\n\n' +
    'Same ticket number as before, so anything already scanned stays scanned.',
    ui.ButtonSet.YES_NO);
  if (sure !== ui.Button.YES) return;

  var sent = sendPass_({
    ticket: ticket, first: trim_(d[R.FIRST - 1]), last: trim_(d[R.LAST - 1]),
    email: email, party: parseInt(d[R.PARTY - 1], 10) || 1,
    guests: trim_(d[R.GUESTS - 1])
  });

  if (sent) {
    sheet.getRange(hit.row, R.SENT).setValue(sent);
    ui.alert('Sent to ' + email + '.');
  } else {
    ui.alert('It would not send. Check Executions in the script editor for why, ' +
             'and how many emails are left today.');
  }
}


/* ==================================================================
   9. THE ADMIN PAGE
   ------------------------------------------------------------------
   Everything the Door menu does, reachable from a phone at the
   event, by more than one person.

   A word about what this security is and is not. The page is public
   and so is this script; what stands between the two is a password
   kept on a tab of the spreadsheet in plain text. Anyone holding one
   can read the whole guest list and send passes. It is a shared
   secret, in the way a key to the office is -- adequate for an
   evening's roster, and no reason for anybody to reuse a password
   they use anywhere else.
   ================================================================== */

/* The office. Add or remove an address here and run
   "Set up the office admin logins" again: anybody missing is
   created with a fresh password, anybody already there is left
   exactly as they are, password included. */
var OFFICE_ADMINS = [
  'yossi@chabadoutreach.org',
  'Chani@chabadoutreach.org',
  'Mendy@chabadoutreach.org'
];

var ADMIN_NAME = 'Admins';
var ADMIN_HEADERS = ['Name', 'Password', 'Added', 'Last seen'];
var A = { NAME: 1, PASS: 2, ADDED: 3, SEEN: 4 };

function getAdminSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ADMIN_NAME) || ss.insertSheet(ADMIN_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(ADMIN_HEADERS);
    sh.getRange(1, 1, 1, ADMIN_HEADERS.length)
      .setFontWeight('bold').setBackground('#0A1E38').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.setColumnWidth(A.PASS, 180);
  }
  return sh;
}

/** The admin behind a name and password, or null. */
function findAdmin_(name, pass) {
  var n = trim_(name).toLowerCase(), pw = trim_(pass);
  if (!n || !pw) return null;

  var rows = adminRows_();
  for (var i = 0; i < rows.length; i++) {
    if (trim_(rows[i][A.NAME - 1]).toLowerCase() !== n) continue;
    if (trim_(rows[i][A.PASS - 1]) !== pw) continue;
    // "Last seen" used to be written on EVERY request - a sheet write
    // per click. Once every five minutes per admin says the same thing.
    try {
      var c = listCache_(), stamp = 'seen:' + n;
      if (!c || !c.get(stamp)) {
        getAdminSheet_().getRange(i + 2, A.SEEN).setValue(new Date());
        if (c) c.put(stamp, '1', 300);
      }
    } catch (e) {}
    return { row: i + 2, name: trim_(rows[i][A.NAME - 1]) };
  }
  return null;
}

/** Everyone registered, with enough detail to act on. */
function adminPeople_() {
  return cachedList_('adminPeople', buildAdminPeople_);
}

function buildAdminPeople_() {
  var sh = getRegSheet_(), last = sh.getLastRow(), list = [];
  var expected = 0, inSoFar = 0;

  if (last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, REG_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      var ticket = trim_(rows[i][R.TICKET - 1]);
      if (!ticket) continue;

      var people = peopleOnRegistration_(rows[i]);
      var already = namesToMap_(rows[i][R.IN_LIST - 1]);

      var namedAny = false;
      for (var k in already) if (already.hasOwnProperty(k)) { namedAny = true; break; }
      if (!namedAny && rows[i][R.IN_AT - 1]) {
        for (var q = 0; q < people.length; q++) already[people[q].name.toLowerCase()] = true;
      }

      var inHere = 0;
      var who = people.map(function (pp) {
        var isIn = !!already[pp.name.toLowerCase()];
        if (isIn) inHere++;
        return { n: pp.name, in: isIn };
      });

      var party = parseInt(rows[i][R.PARTY - 1], 10) || people.length;
      expected += party;
      inSoFar += inHere;

      list.push({
        row: i + 2, t: ticket,
        n: fullName_(rows[i][R.FIRST - 1], rows[i][R.LAST - 1]),
        e: trim_(rows[i][R.EMAIL - 1]),
        ph: trim_(rows[i][R.PHONE - 1]),
        p: party, people: who, inCount: inHere,
        sent: rows[i][R.SENT - 1] ? String(rows[i][R.SENT - 1]) : '',
        at: rows[i][R.IN_AT - 1] ? new Date(rows[i][R.IN_AT - 1]).getTime() : 0,
        by: trim_(rows[i][R.IN_BY - 1])
      });
    }
  }

  return { ok: true, list: list, households: list.length,
           expected: expected, inSoFar: inSoFar };
}

/** Put somebody back outside the gate. */
function adminUndoCheckIn___raw(admin, ticket, who) {
  var t = trim_(ticket).toUpperCase().replace(TICKET_TAG, '');
  if (!t) return { ok: false, error: 'No ticket given.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { ok: false, error: 'Busy, try again.' }; }

  try {
    var sh = getRegSheet_(), last = sh.getLastRow();
    if (last < 2) return { ok: false, error: 'Nobody is registered.' };

    var rows = sh.getRange(2, 1, last - 1, REG_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (trim_(rows[i][R.TICKET - 1]).toUpperCase() !== t) continue;

      var row = i + 2;
      var people = peopleOnRegistration_(rows[i]);
      var already = namesToMap_(rows[i][R.IN_LIST - 1]);

      var namedAny = false;
      for (var k in already) if (already.hasOwnProperty(k)) { namedAny = true; break; }
      if (!namedAny && rows[i][R.IN_AT - 1]) {
        for (var q = 0; q < people.length; q++) already[people[q].name.toLowerCase()] = true;
      }

      var taking = trim_(who);
      var removed = [];
      if (!taking || taking.toUpperCase() === 'ALL') {
        for (var r2 = 0; r2 < people.length; r2++) {
          if (already[people[r2].name.toLowerCase()]) removed.push(people[r2].name);
        }
        already = {};
      } else {
        var wanted = namesToMap_(taking);
        for (var r3 = 0; r3 < people.length; r3++) {
          var key = people[r3].name.toLowerCase();
          if (wanted[key] && already[key]) { removed.push(people[r3].name); delete already[key]; }
        }
      }

      var left = mapToNames_(people, already);
      sh.getRange(row, R.IN_LIST).setValue(left);

      // With nobody left inside, the row goes back to never-scanned.
      if (!left) {
        sh.getRange(row, R.IN_AT).setValue('');
        sh.getRange(row, R.IN_BY).setValue('');
        sh.getRange(row, R.HOW).setValue('');
      }

      logScan_({ name: admin.name + ' (admin)' }, t,
               fullName_(rows[i][R.FIRST - 1], rows[i][R.LAST - 1]) +
               (removed.length ? ' (' + removed.join(', ') + ')' : ''),
               removed.length, 'Check-in undone', 'admin');

      return { ok: true, removed: removed, left: left };
    }
    return { ok: false, error: 'No pass with that number.' };
  } finally {
    lock.releaseLock();
  }
}

/** Send a pass again, from the phone rather than the menu. */
function adminResend___raw(admin, ticket) {
  var t = trim_(ticket).toUpperCase().replace(TICKET_TAG, '');
  var sh = getRegSheet_(), last = sh.getLastRow();
  if (last < 2) return { ok: false, error: 'Nobody is registered.' };

  var rows = sh.getRange(2, 1, last - 1, REG_HEADERS.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (trim_(rows[i][R.TICKET - 1]).toUpperCase() !== t) continue;

    var email = trim_(rows[i][R.EMAIL - 1]);
    if (!email) return { ok: false, error: 'No email address on file for them.' };

    var sent = sendPass_({
      ticket: t, first: trim_(rows[i][R.FIRST - 1]), last: trim_(rows[i][R.LAST - 1]),
      email: email, party: parseInt(rows[i][R.PARTY - 1], 10) || 1,
      guests: trim_(rows[i][R.GUESTS - 1])
    });
    if (!sent) return { ok: false, error: 'It would not send. Check the daily email limit.' };

    sh.getRange(i + 2, R.SENT).setValue(sent);
    return { ok: true, to: email };
  }
  return { ok: false, error: 'No pass with that number.' };
}

/** Change how many people a registration covers. */
function adminSetParty___raw(admin, ticket, howMany) {
  var t = trim_(ticket).toUpperCase().replace(TICKET_TAG, '');
  var n = parseInt(howMany, 10);
  if (!(n > 0 && n <= 60)) return { ok: false, error: 'That is not a sensible number.' };

  var sh = getRegSheet_(), last = sh.getLastRow();
  var rows = sh.getRange(2, 1, Math.max(1, last - 1), REG_HEADERS.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (trim_(rows[i][R.TICKET - 1]).toUpperCase() !== t) continue;
    sh.getRange(i + 2, R.PARTY).setValue(n);
    return { ok: true, party: n };
  }
  return { ok: false, error: 'No pass with that number.' };
}

/* ---------- volunteers and admins, from the phone ---------- */

function adminStaff_() {
  var sh = getStaffSheet_(), last = sh.getLastRow(), out = [];
  if (last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, STAFF_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (!trim_(rows[i][S.NAME - 1]) && !trim_(rows[i][S.CODE - 1])) continue;
      out.push({ row: i + 2, n: trim_(rows[i][S.NAME - 1]), c: trim_(rows[i][S.CODE - 1]),
                 used: rows[i][S.USED - 1] ? new Date(rows[i][S.USED - 1]).getTime() : 0,
                 count: parseInt(rows[i][S.COUNT - 1], 10) || 0 });
    }
  }
  return { ok: true, list: out };
}

function adminAddStaff___raw(admin, name) {
  var n = trim_(name);
  if (!n) return { ok: false, error: 'Give them a name.' };
  var code = newStaffCode_();
  getStaffSheet_().appendRow([n, code, new Date(), '', 0]);
  return { ok: true, name: n, code: code };
}

function adminRemoveStaff___raw(admin, code) {
  var c = trim_(code).toUpperCase();
  var sh = getStaffSheet_(), last = sh.getLastRow();
  if (last < 2) return { ok: false, error: 'Nobody to remove.' };
  var rows = sh.getRange(2, S.CODE, last - 1, 1).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (trim_(rows[i][0]).toUpperCase() === c) { sh.deleteRow(i + 2); return { ok: true }; }
  }
  return { ok: false, error: 'No volunteer with that code.' };
}

function adminList_() {
  var sh = getAdminSheet_(), last = sh.getLastRow(), out = [];
  if (last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, ADMIN_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      var n = trim_(rows[i][A.NAME - 1]);
      if (!n) continue;
      out.push({ row: i + 2, n: n,
                 seen: rows[i][A.SEEN - 1] ? new Date(rows[i][A.SEEN - 1]).getTime() : 0 });
    }
  }
  return { ok: true, list: out };          /* passwords never leave */
}

function adminAddAdmin___raw(admin, name, pass) {
  var n = trim_(name), pw = trim_(pass);
  if (!n) return { ok: false, error: 'Give them a name.' };
  if (pw.length < 6) return { ok: false, error: 'Six characters or more, please.' };
  if (findAdminByName_(n)) return { ok: false, error: 'Somebody already has that name.' };
  getAdminSheet_().appendRow([n, pw, new Date(), '']);
  return { ok: true, name: n };
}

function findAdminByName_(name) {
  var n = trim_(name).toLowerCase();
  var sh = getAdminSheet_(), last = sh.getLastRow();
  if (last < 2) return 0;
  var rows = sh.getRange(2, A.NAME, last - 1, 1).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (trim_(rows[i][0]).toLowerCase() === n) return i + 2;
  }
  return 0;
}

function adminRemoveAdmin___raw(admin, name) {
  var row = findAdminByName_(name);
  if (!row) return { ok: false, error: 'No admin by that name.' };
  if (trim_(name).toLowerCase() === trim_(admin.name).toLowerCase()) {
    return { ok: false, error: 'You cannot remove yourself.' };
  }
  if (getAdminSheet_().getLastRow() <= 2) {
    return { ok: false, error: 'That is the last admin. Add another first.' };
  }
  getAdminSheet_().deleteRow(row);
  return { ok: true };
}

/**
 * The first admin.
 *
 * Run from the editor, once, so there is somebody who can sign in
 * before anybody can sign in to add them.
 */
function createTheFirstAdmin__raw() {
  var ui = SpreadsheetApp.getUi();
  var sh = getAdminSheet_();
  if (sh.getLastRow() > 1) {
    ui.alert('There are admins already. Add more from the admin page itself.');
    return;
  }
  var who = ui.prompt('First admin', 'Your name (this is what you will sign in with):',
                      ui.ButtonSet.OK_CANCEL);
  if (who.getSelectedButton() !== ui.Button.OK) return;
  var name = trim_(who.getResponseText());
  if (!name) { ui.alert('No name, no admin.'); return; }

  var pwBits = newReadablePassword_();

  sh.appendRow([name, pwBits, new Date(), '']);
  ui.alert('You can sign in.\n\n' +
           'Name:      ' + name + '\n' +
           'Password:  ' + pwBits + '\n\n' +
           'At chanukahinhouston.com/admin\n\n' +
           'Both are on the "' + ADMIN_NAME + '" tab, and you can change the ' +
           'password there to something you will remember.');
}


/**
 * Create a login for everyone in OFFICE_ADMINS.
 *
 * Run it as often as you like. Anybody already on the Admins tab is
 * left alone -- password and all -- so this never quietly resets
 * somebody who is mid-event and signed in.
 *
 * The passwords are shown once, here. They are also on the Admins
 * tab, because a password nobody can look up is a password somebody
 * will be locked out by at six o'clock on a Sunday.
 */
function setUpOfficeAdmins__raw() {
  var ui = SpreadsheetApp.getUi();
  var sh = getAdminSheet_();
  var made = [], already = [];

  for (var i = 0; i < OFFICE_ADMINS.length; i++) {
    var who = trim_(OFFICE_ADMINS[i]);
    if (!who) continue;

    if (findAdminByName_(who)) { already.push(who); continue; }

    var pw = newReadablePassword_();
    sh.appendRow([who, pw, new Date(), '']);
    made.push(who + '\n     ' + pw);
  }

  var lines = [];
  if (made.length) {
    lines.push(made.length + ' login' + (made.length === 1 ? '' : 's') + ' created:\n');
    lines.push('  ' + made.join('\n\n  '));
  }
  if (already.length) {
    lines.push((made.length ? '\n' : '') + 'Already had a login, left untouched:\n  ' +
               already.join('\n  '));
  }
  if (!made.length && !already.length) lines.push('OFFICE_ADMINS is empty.');

  lines.push('\nThey sign in at chanukahinhouston.com/admin');
  lines.push('Every password is on the "' + ADMIN_NAME + '" tab, and can be ' +
             'changed there to something they will remember.');

  ui.alert('Office logins', lines.join('\n'), ui.ButtonSet.OK);
}

/**
 * A password somebody can read down a phone without spelling it.
 * No l/1, no O/0, and broken into threes.
 */
function newReadablePassword_() {
  var abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  var out = [];
  for (var block = 0; block < 3; block++) {
    var bit = '';
    for (var i = 0; i < 3; i++) bit += abc.charAt(Math.floor(Math.random() * abc.length));
    out.push(bit);
  }
  return out.join('-');
}

/* ------------------------------------------------------------------
   Every function that writes to the Registrations tab clears the list
   cache on its way out - in a finally, so a thrown error cannot leave
   a stale list behind. The real bodies are the __raw functions. */
function checkIn_(staff, ticket, how, who) {
  try { return checkIn___raw(staff, ticket, how, who); }
  finally { forgetLists_(); }
}
function adminUndoCheckIn_(admin, ticket, who) {
  try { return adminUndoCheckIn___raw(admin, ticket, who); }
  finally { forgetLists_(); }
}
function adminSetParty_(admin, ticket, howMany) {
  try { return adminSetParty___raw(admin, ticket, howMany); }
  finally { forgetLists_(); }
}
function adminResend_(admin, ticket) {
  try { return adminResend___raw(admin, ticket); }
  finally { forgetLists_(); }
}
function growHousehold_(sheet, row, parsed, html) {
  try { return growHousehold___raw(sheet, row, parsed, html); }
  finally { forgetLists_(); }
}
function pollRegistrationEmails(wide) {
  try { return pollRegistrationEmails__raw(wide); }
  finally { forgetLists_(); }
}
function startTestingOver() {
  try { return startTestingOver__raw(); }
  finally { forgetLists_(); }
}
function bringOverOldEntries() {
  try { return bringOverOldEntries__raw(); }
  finally { forgetLists_(); }
}
function tidyGuestNames() {
  try { return tidyGuestNames__raw(); }
  finally { forgetLists_(); }
}
function sendSomeonesPassAgain() {
  try { return sendSomeonesPassAgain__raw(); }
  finally { forgetLists_(); }
}
function sendMyselfATestPass() {
  try { return sendMyselfATestPass__raw(); }
  finally { forgetLists_(); }
}
function markWinner_(p) {
  try { return markWinner___raw(p); }
  finally { forgetLists_(); }
}

/* Writers to the staff and admin tabs forget the people cache. */
function addCheckInVolunteer() {
  try { return addCheckInVolunteer__raw(); }
  finally { forgetPeople_(); }
}
function adminAddStaff_(admin, name) {
  try { return adminAddStaff___raw(admin, name); }
  finally { forgetPeople_(); }
}
function adminRemoveStaff_(admin, code) {
  try { return adminRemoveStaff___raw(admin, code); }
  finally { forgetPeople_(); }
}
function adminAddAdmin_(admin, name, pass) {
  try { return adminAddAdmin___raw(admin, name, pass); }
  finally { forgetPeople_(); }
}
function adminRemoveAdmin_(admin, name) {
  try { return adminRemoveAdmin___raw(admin, name); }
  finally { forgetPeople_(); }
}
function setUpOfficeAdmins() {
  try { return setUpOfficeAdmins__raw(); }
  finally { forgetPeople_(); }
}
function createTheFirstAdmin() {
  try { return createTheFirstAdmin__raw(); }
  finally { forgetPeople_(); }
}
