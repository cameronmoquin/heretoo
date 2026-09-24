// Report a problem — the study guide's way of hearing "this one is wrong."
//
// Every page under /fsot/ already knows which artifact it is, so the reader
// never has to say where they are. The kind and the id come from the URL and
// from the drill box's own data-lesson; the person only says what is wrong.
//
//   /fsot/guide/<slug>.html   -> kind 'guide',   ref_id <slug>
//   /fsot/listen/<code>.html  -> kind 'episode', ref_id <code>
//   a page with a drill       -> also offers    kind 'drill',  ref_id <lesson>
//
// Posts to public.content_reports (migration 100) with the publishable key,
// same as the analytics beacon. The table is write-only: no policy lets any
// client read a single report back.
//
// Fails silently and completely. A study guide whose report button throws an
// error in the console is worse than one with no report button.

(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────────────
  // COPY — Cameron writes these. Placeholders; every visible string on
  // the page is in this block and nowhere else.
  // ──────────────────────────────────────────────────────────────────
  var COPY = {
    open:        'Report a problem',
    heading:     'What is wrong?',
    notePlace:   '',
    contactLabel:'Email, if you want an answer',
    send:        'Send',
    cancel:      'Cancel',
    sent:        'Sent. Thank you.',
    failed:      'That did not send. Try again later.',
  };

  var ENDPOINT = 'https://rhvidcltwftwhhttelms.supabase.co/rest/v1/content_reports';
  var APIKEY = 'sb_publishable_FmUWdnA1auknsOE8lByolQ_aCnOv-Bc';
  var NOTE_MAX = 2000;      // mirrors the column's CHECK
  var CONTACT_MAX = 200;

  /** What is this page? Returns null on any page that is not a reportable
   *  artifact (the index, the plan, subscribe), which simply gets no button. */
  function identify() {
    var p = location.pathname;
    var m = p.match(/^\/fsot\/guide\/([a-z0-9-]+)\.html$/i);
    // 'index' is the section's own contents page, not a write-up. It is
    // normally served at /fsot/guide/ (which the pattern already misses),
    // but a direct hit on /fsot/guide/index.html would otherwise file
    // reports against a table of contents.
    if (m && m[1].toLowerCase() !== 'index') return { kind: 'guide', ref_id: m[1] };
    m = p.match(/^\/fsot\/listen\/([a-z0-9-]+)\.html$/i);
    if (m && m[1].toLowerCase() !== 'index') return { kind: 'episode', ref_id: m[1] };
    return null;
  }

  /** The drill on this page, if it has one. Reported separately from the
   *  write-up, because "the drill has the wrong order" and "the chain is
   *  wrong" are different bugs with different fixes. */
  function drillTarget() {
    var box = document.getElementById('drill');
    var lesson = box && box.dataset ? box.dataset.lesson : '';
    return lesson ? { kind: 'drill', ref_id: lesson } : null;
  }

  var page = identify();
  if (!page) return;
  var drill = drillTarget();

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function send(target, note, contact, done) {
    var body = {
      kind: target.kind,
      ref_id: target.ref_id,
      page: location.pathname,
      note: note.slice(0, NOTE_MAX),
      contact: contact ? contact.slice(0, CONTACT_MAX) : null,
    };
    fetch(ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      // Same reason as the analytics beacon: sendBeacon always sends
      // credentials, which Supabase's wildcard CORS rejects.
      credentials: 'omit',
      headers: {
        apikey: APIKEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    }).then(function (r) { done(r && r.ok); }).catch(function () { done(false); });
  }

  function build() {
    var wrap = el('div', { class: 'report' });

    var btn = el('button', { type: 'button', class: 'report-open' }, COPY.open);
    wrap.appendChild(btn);

    var form = el('div', { class: 'report-form', hidden: 'hidden' });

    // Which thing. Only shown when the page has both a write-up and a
    // drill; otherwise there is nothing to choose and the question would
    // be furniture.
    var target = page;
    if (drill) {
      var pick = el('select', { class: 'report-target', 'aria-label': COPY.heading });
      var oPage = el('option', { value: 'page' }, document.title || page.ref_id);
      var oDrill = el('option', { value: 'drill' }, 'Drill');
      pick.appendChild(oPage); pick.appendChild(oDrill);
      pick.addEventListener('change', function () {
        target = pick.value === 'drill' ? drill : page;
      });
      form.appendChild(pick);
    }

    var note = el('textarea', {
      class: 'report-note', rows: '3', maxlength: String(NOTE_MAX),
      'aria-label': COPY.heading, placeholder: COPY.notePlace,
    });
    form.appendChild(note);

    var contact = el('input', {
      class: 'report-contact', type: 'email', maxlength: String(CONTACT_MAX),
      'aria-label': COPY.contactLabel, placeholder: COPY.contactLabel,
    });
    form.appendChild(contact);

    var row = el('div', { class: 'report-row' });
    var sendBtn = el('button', { type: 'button', class: 'report-send' }, COPY.send);
    var cancelBtn = el('button', { type: 'button', class: 'report-cancel' }, COPY.cancel);
    row.appendChild(sendBtn); row.appendChild(cancelBtn);
    form.appendChild(row);

    var status = el('div', { class: 'report-status', role: 'status' });
    form.appendChild(status);

    wrap.appendChild(form);

    btn.addEventListener('click', function () {
      form.hidden = false;
      btn.hidden = true;
      note.focus();
    });
    cancelBtn.addEventListener('click', function () {
      form.hidden = true;
      btn.hidden = false;
      status.textContent = '';
    });
    sendBtn.addEventListener('click', function () {
      var text = (note.value || '').trim();
      // The column refuses an empty note; refuse it here too rather than
      // firing a request that can only fail.
      if (!text) { note.focus(); return; }
      sendBtn.disabled = true;
      send(target, text, (contact.value || '').trim(), function (ok) {
        sendBtn.disabled = false;
        status.textContent = ok ? COPY.sent : COPY.failed;
        if (ok) {
          note.value = ''; contact.value = '';
          form.hidden = true; btn.hidden = false;
        }
      });
    });

    return wrap;
  }

  function mount() {
    try {
      var foot = document.querySelector('footer.site') || document.body;
      foot.parentNode.insertBefore(build(), foot);
    } catch (e) { /* a broken report button must never break the page */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
