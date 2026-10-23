/* Farm Visit — on-screen guide.
   Flash cards that point at each tab, button and input, one screen at a time. Each screen's
   guide plays once, the first time it is opened, and the ? button replays it whenever needed. */
(function () {
  'use strict';
  var APP = window.FV_APP || 'form';
  var SEEN_KEY = 'fv_tour_seen_v1';

  /* ---------- the cards ----------
     sel: a CSS selector, a list of them (first visible wins), or 'text:<tag>:<words>'.
     A card whose target is missing or hidden is skipped, so one list fits phone and desktop;
     unless: skip the card when that other element is showing. */
  var HELP = { sel: '#fvhelp', t: 'Need this again?', d: 'Tap ? any time to replay the guide for the screen you are on.' };
  var REPORTS = [
    { sel: '[data-rc=page][data-arg=dash]', t: 'Dashboard', d: 'Headline numbers and graphs for the visits you pick.' },
    { sel: '[data-rc=page][data-arg=findings]', t: 'Findings', d: 'Every open action from the visits, with its due date. Overdue ones are flagged.' },
    { sel: '.rmain [data-rc=menu][aria-expanded]', unless: '#rside .opt[data-rc=period]', t: 'Filters and pages', d: 'Open this to switch between Dashboard and Findings, and to pick the period, farms, bird type and auditor. Downloads are in here too.' },
    { sel: '#rside .opt[data-rc=period]', t: 'Filters', d: 'Pick the period, farms, bird type and auditor. Every graph and number follows these filters.' },
    { sel: '#rside [data-rc=farmall]', t: 'Farms', d: 'All farms, or tap a few to compare just those.' },
    { sel: '#rside [data-rc=agg]', t: 'Compare as', d: 'Average, latest, highest or lowest reading per farm.' },
    { sel: '.gtabs', t: 'Report tabs', d: 'Show one report at a time, or Show all.' },
    { sel: '[data-rc=cm]', t: 'Reading chips', d: 'Switch which reading the graph shows, like total mortality or livability.' },
    { sel: '#rside [data-rc=pdf]', t: 'Download', d: 'Save everything as a PDF report, or as a CSV to open in Excel.' },
    HELP
  ];
  var TOURS = {
    'form:entry': [
      { t: 'Welcome to Farm Visit', d: 'A one-minute tour of the visit form. Tap Next to see each part, or Skip if you know it already.' },
      { sel: '[data-rc=view][data-arg=entry]', t: 'Visit data', d: 'Fill in the visit here: farm, flock, feed, growth, audit checks and signatures.' },
      { sel: '[data-rc=view][data-arg=live]', t: 'Live readings', d: 'Scores and readings work themselves out as you type, coloured green, amber or red against target.' },
      { sel: '[data-rc=view][data-arg=reports]', t: 'Reports', d: 'Graphs and findings across all visits, with filters for farms and dates.' },
      { sel: '#rail', t: 'Section bar', d: 'Jump straight to Visit, Flock, Feed, Growth, Audit, Custom or Sign. It follows you as you scroll.' },
      { sel: '#s0 .hero', t: 'Visit card', d: 'Shows the farm you picked and its score egg. The fuller the yolk, the better the score.' },
      { sel: '[data-date=date]', t: 'Visit date', d: 'Today is filled in for you. Tap to pick another date.' },
      { sel: '[data-list=purpose]', t: 'Purpose', d: 'Tap to choose why you are visiting, such as a routine audit or a follow-up.' },
      { sel: '[data-list=farmer]', t: 'Farmer and farm', d: 'Tap to pick from the list; it fills in the farm, location and phone. New farm? Choose “Add a new farm…”.' },
      { sel: '#s1 .stt', t: 'Flock', d: 'Pick Layer or Broiler first. The form then shows only the fields for that bird type.' },
      { sel: '[data-num]', t: 'Number tiles', d: 'Tap a tile to enter a number. A scroll wheel or keypad opens with the unit shown. Change the style in ⚙ Settings → Number entry.' },
      { sel: '#s4 .stt', t: 'Audit checks', d: 'Count what you see on the farm. Every check adds to the audit score.' },
      { sel: '#sgA', t: 'Signatures', d: 'The auditor and the farmer sign here with a finger. Tap Clear to sign again.' },
      { sel: '[data-act=savevisit]', t: 'Save visit', d: 'Saves on this phone straight away and sends it to the Google Sheet when online. No signal? It syncs by itself later.' },
      { sel: '#eggb', t: 'Score egg', d: 'Tap the egg any time to see every reading for this visit.' },
      { sel: '[data-act=history]', t: 'Saved reports', d: 'Your saved visits. Open the PDF report, edit a visit, repeat it, or start a new one.' },
      { sel: '#langb', t: 'Language', d: 'Switch between English, Hinglish and Hindi.' },
      { sel: '[data-act=settings]', t: 'Settings', d: 'Number entry style, change password, backups and sign out.' },
      HELP
    ],
    'form:live': [
      { sel: '[data-rc=lpto]', t: 'Reading groups', d: 'Switch between the audit scorecard and each group of readings, or Show all.' },
      { sel: '#main .stt', t: 'Scorecard', d: 'Every check with its points. Red items cost the most, so fix those first.' },
      { sel: '[data-rc=lpnext]', t: 'Next and previous', d: 'Step through the groups one at a time.' },
      HELP
    ],
    'form:reports': REPORTS,
    'reports:reports': [{ t: 'Welcome to Reports', d: 'Read-only graphs and findings from every farm visit. Here is a quick look around.' }].concat(REPORTS),
    'admin:overview': [
      { t: 'Welcome to the Admin console', d: 'Set up what auditors fill in, manage farms and people, and see every visit. A quick look around.' },
      { sel: '#nav', t: 'Menu', d: 'Each section manages one part of the app. Every section has its own short guide the first time you open it.' },
      { sel: 'text:h2:Farms, weakest first', t: 'Farms, weakest first', d: 'The farms that need attention most are at the top, with their latest and average scores.' },
      { sel: 'text:h2:Download everything', t: 'Download everything', d: 'Export all visits and readings as CSV for Excel, or a full backup.' },
      { sel: ['#nav a[href="index.html"]', '#top a[href="index.html"]'], t: 'Other apps', d: 'Jump to the visit form or the reports with the same sign-in.' },
      HELP
    ],
    'admin:visits': [
      { sel: '#vq', t: 'Search visits', d: 'Find a visit by farm, farmer, auditor or visit number.' },
      { sel: '[data-act=vdel]', t: 'Delete a visit', d: 'Removes the visit for everyone. Only admins can do this.' }
    ],
    'admin:metrics': [
      { sel: '[data-act=ty]', t: 'Bird type', d: 'Layer and Broiler have their own readings. Pick one to set it up.' },
      { sel: 'input[data-tg=kpi]', t: 'Show or hide', d: 'Untick a reading to hide it from the visit form and the reports.' },
      { sel: '[data-act=lim]', t: 'Limits', d: 'Set the green, amber and red limits for a reading to suit your farms.' }
    ],
    'admin:allkpis': [
      { sel: '#aq', t: 'Search', d: 'Find any reading or check by name.' },
      { sel: '#ak', t: 'Kind', d: 'Filter to built-in readings, audit checks or your own metrics.' },
      { sel: '[data-act=allon]', t: 'All or none', d: 'Switch every KPI on or off for a bird type in one go.' }
    ],
    'admin:fields': [
      { sel: '[data-act=fnew]', t: 'Add a field', d: 'Add your own question to the visit form: a number, yes/no, a choice or text.' },
      { sel: '[data-act=fedit]', t: 'Edit and order', d: 'Change a field, or move it up and down with the arrows.' }
    ],
    'admin:kpis': [
      { sel: '[data-act=knew]', t: 'Add a metric', d: 'Build your own reading with a formula from the form fields, with its own targets.' },
      { sel: '[data-act=kedit]', t: 'Edit a metric', d: 'Change the formula, unit or targets.' }
    ],
    'admin:farms': [
      { sel: '[data-act=fnew2]', t: 'Add a farm', d: 'Add a farm with its farmer, location, phone and bird type. Auditors can add farms from the form too.' },
      { sel: '[data-act=fimport]', t: 'Import a list', d: 'Paste a whole list of farms at once.' },
      { sel: '#fq', t: 'Search farms', d: 'Find a farm by name, farmer or place.' },
      { sel: '[data-act=fedit2]', t: 'Edit or archive', d: 'Only admins can change or archive a farm. Archived farms keep their visits.' }
    ],
    'admin:team': [
      { sel: '[data-act=unew]', t: 'Add a person', d: 'Add an auditor, viewer or admin with a username or email. You get a temporary password to send them.' },
      { sel: 'select[data-role]', t: 'Role', d: 'Auditors fill in visits, viewers only read reports, admins manage everything.' },
      { sel: '[data-act=ureset]', t: 'Reset password', d: 'Gives the person a new temporary password.' },
      { sel: '[data-act=utog]', t: 'Deactivate', d: 'Stops someone signing in. Their visits stay.' }
    ],
    'admin:org': [
      { sel: '#o_n', t: 'Organisation name', d: 'Shown on sign-in screens and on every PDF report.' },
      { sel: '#o_l', t: 'Default language', d: 'The language the visit form starts in. Each person can still switch.' },
      { sel: '#o_s', t: 'Auditor sign-up', d: 'Let auditors create their own account with a username and password, or only let admins add people.' },
      { sel: '[data-act=osave]', t: 'Save', d: 'Saves the organisation settings for everyone.' },
      { sel: '[data-act=sheet]', t: 'Your Google Sheet', d: 'Open the sheet that holds all the data.' },
      { sel: 'text:h2:Links for your team', t: 'Links for your team', d: 'Ready-made links for the visit form and reports. Send them to your people.' }
    ]
  };

  /* ---------- which screen is showing ---------- */
  function screenKey() {
    if (APP === 'admin') return 'admin:' + ((location.hash || '#overview').slice(1) || 'overview');
    var v = 'entry'; try { v = view; } catch (e) {}
    return APP + ':' + v;
  }
  function busy() {
    if (document.querySelector('#fvr main, #rv, dialog[open]')) return true;
    try { if (SH) return true; } catch (e) {}
    return false;
  }
  function seen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; } }
  function markSeen(k) { var s = seen(); s[k] = 1; try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch (e) {} }

  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect(), st = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && r.right > 0 && r.left < innerWidth && st.visibility !== 'hidden' && st.display !== 'none';
  }
  function find(sel) {
    var list = Array.isArray(sel) ? sel : [sel];
    for (var i = 0; i < list.length; i++) {
      var s = list[i], hits;
      if (s.indexOf('text:') === 0) {
        var p = s.split(':'), words = p.slice(2).join(':').toLowerCase();
        hits = [].filter.call(document.querySelectorAll(p[1]), function (e) { return (e.textContent || '').trim().toLowerCase().indexOf(words) === 0; });
      } else hits = document.querySelectorAll(s);
      for (var j = 0; j < hits.length; j++) if (visible(hits[j])) return hits[j];
    }
    return null;
  }

  /* ---------- look ---------- */
  var css = '#fvt{position:fixed;inset:0;z-index:100000;font:15px/1.45 "Atkinson Hyperlegible",ui-sans-serif,system-ui,sans-serif;color:#0d2a25}' +
    '#fvt .fvt-sp{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(6,22,18,.62);transition:all .25s ease;pointer-events:none}' +
    '#fvt .fvt-sp.fvt-on{outline:3px solid #f4b324;outline-offset:2px;animation:fvtp 1.6s ease-in-out infinite}' +
    '#fvt .fvt-sp.fvt-none{left:50%!important;top:40%!important;width:0!important;height:0!important;outline:0;animation:none}' +
    '@keyframes fvtp{50%{outline-color:rgba(244,179,36,.35)}}' +
    '#fvt .fvt-cd{position:fixed;width:min(340px,calc(100vw - 24px));background:#fff;border-radius:18px;padding:16px 16px 12px;box-shadow:0 18px 44px rgba(0,0,0,.28);transition:top .25s ease,left .25s ease}' +
    '#fvt .fvt-st{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#0b7466;margin:0 0 4px}' +
    '#fvt h3{margin:0 0 6px;font:800 19px/1.2 "Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif}#fvt p{margin:0;color:#3d5a53}' +
    '#fvt .fvt-dt{display:flex;gap:5px;margin:14px 0 10px;flex-wrap:wrap}#fvt .fvt-dt i{width:7px;height:7px;border-radius:9px;background:#d6e0db}#fvt .fvt-dt i.fvt-on{background:#0b7466;width:18px}' +
    '#fvt .fvt-bt{display:flex;align-items:center;gap:8px}#fvt .fvt-bt .fvt-gr{flex:1}#fvt button{font:700 15px inherit;font-family:inherit;border:0;border-radius:12px;padding:10px 14px;cursor:pointer;min-height:42px}' +
    '#fvt .fvt-nx{background:#0b7466;color:#fff;padding:10px 18px}#fvt .fvt-bk{background:#e1ebe6;color:#0d2a25}#fvt .fvt-sk{background:none;color:#56706a;padding:10px 4px}' +
    '@media (prefers-color-scheme:dark){#fvt .fvt-cd{background:#112320;color:#e5f1ed}#fvt p{color:#b5cbc4}#fvt .fvt-bk{background:#21362f;color:#e5f1ed}#fvt .fvt-dt i{background:#2b453d}#fvt .fvt-sk{color:#8fa9a1}}' +
    '.fvhq{font-weight:800!important}';

  var el = null, steps = [], at = 0, key = '', target = null;

  function stop(done) {
    if (!el) return;
    el.remove(); el = null; target = null;
    removeEventListener('resize', place); removeEventListener('scroll', place, true); document.removeEventListener('keydown', onKey, true);
    if (done !== false) markSeen(key);
  }
  function onKey(e) {
    if (!el) return;
    if (e.key === 'Escape') { e.preventDefault(); stop(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); go(at + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
  }
  function start(k, force) {
    var list = TOURS[k]; if (!list) return;
    var usable = list.filter(function (s) { return (!s.sel || find(s.sel)) && !(s.unless && find(s.unless)); });
    if (!usable.length || (usable.length === 1 && usable[0] === HELP && !force)) return;
    stop(false); key = k; steps = usable; at = 0;
    el = document.createElement('div'); el.id = 'fvt'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    var st = document.createElement('style'); st.textContent = css; el.appendChild(st);
    el.insertAdjacentHTML('beforeend', '<div class="fvt-sp"></div><div class="fvt-cd" aria-live="polite"><p class="fvt-st"></p><h3></h3><p class="fvt-tx"></p><div class="fvt-dt"></div><div class="fvt-bt"><button class="fvt-sk" type="button">Skip</button><span class="fvt-gr"></span><button class="fvt-bk" type="button">Back</button><button class="fvt-nx" type="button">Next</button></div></div>');
    document.body.appendChild(el);
    el.querySelector('.fvt-sk').onclick = function () { stop(); };
    el.querySelector('.fvt-bk').onclick = function () { go(at - 1); };
    el.querySelector('.fvt-nx').onclick = function () { go(at + 1); };
    addEventListener('resize', place); addEventListener('scroll', place, true); document.addEventListener('keydown', onKey, true);
    go(0);
  }
  function go(i) {
    if (!el) return;
    if (i >= steps.length) { stop(); return; }
    if (i < 0) return;
    var dir = i >= at ? 1 : -1, s = steps[i];
    target = s.sel ? find(s.sel) : null;
    if (s.sel && !target) { at = i; go(i + dir); return; }   // it went away since the tour began
    at = i;
    el.querySelector('.fvt-st').textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
    el.querySelector('h3').textContent = s.t;
    el.querySelector('.fvt-tx').textContent = s.d;
    el.querySelector('.fvt-dt').innerHTML = steps.map(function (_, j) { return '<i class="' + (j === i ? 'fvt-on' : '') + '"></i>'; }).join('');
    el.querySelector('.fvt-bk').style.visibility = i ? 'visible' : 'hidden';
    el.querySelector('.fvt-nx').textContent = i === steps.length - 1 ? 'Got it' : 'Next';
    if (target) {
      var r = target.getBoundingClientRect(), pos = getComputedStyle(target).position;
      if (pos !== 'fixed' && pos !== 'sticky' && (r.top < 70 || r.bottom > innerHeight - 110)) target.scrollIntoView({ block: 'center' });
    }
    place();
    el.querySelector('.fvt-nx').focus({ preventScroll: true });
  }
  function place() {
    if (!el) return;
    var sp = el.querySelector('.fvt-sp'), cd = el.querySelector('.fvt-cd'), W = innerWidth, H = innerHeight, pad = 6, m = 12;
    var ch = cd.offsetHeight, cw = cd.offsetWidth, top, left;
    if (!target) {
      sp.className = 'fvt-sp fvt-none';
      top = (H - ch) / 2; left = (W - cw) / 2;
    } else {
      var r = target.getBoundingClientRect();
      var x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(W - 8, r.width + pad * 2), h = Math.min(H - 8, r.height + pad * 2);
      sp.className = 'fvt-sp fvt-on'; sp.style.left = x + 'px'; sp.style.top = y + 'px'; sp.style.width = w + 'px'; sp.style.height = h + 'px';
      if (y + h + m + ch < H) top = y + h + m;            // below
      else if (y - m - ch > 0) top = y - m - ch;          // above
      else top = Math.max(m, H - ch - m);                 // over it, at the bottom
      left = Math.min(Math.max(m, r.left + r.width / 2 - cw / 2), W - cw - m);
    }
    cd.style.top = top + 'px'; cd.style.left = left + 'px';
  }

  /* ---------- the ? button ---------- */
  function helpButton() {
    if (document.getElementById('fvhelp')) return;
    var b;
    if (APP === 'admin') {
      var out = find('[data-act=out]'); if (!out) return;
      b = document.createElement('a'); b.href = '#'; b.textContent = 'Guide'; b.style.marginLeft = '10px';
      out.parentNode.insertBefore(b, out.nextSibling);
    } else {
      var h = document.querySelector('[data-act=history]'); if (!h) return;
      b = document.createElement('button'); b.type = 'button'; b.className = h.className + ' fvhq'; b.textContent = '?';
      h.parentNode.insertBefore(b, h);
    }
    b.id = 'fvhelp'; b.setAttribute('aria-label', 'Show the guide for this screen'); b.title = 'Guide';
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); start(screenKey(), true); });
  }

  /* ---------- watch for screens opening ---------- */
  var last = '', since = 0;
  setInterval(function () {
    helpButton();
    if (el || busy()) { since = 0; return; }
    var k = screenKey();
    if (k !== last) { last = k; since = Date.now(); return; }
    if (!since || Date.now() - since < 900) return;   // let the screen settle first
    since = 0;
    if (TOURS[k] && !seen()[k]) start(k);
  }, 400);

  window.FVTour = { start: function (k) { start(k || screenKey(), true); }, reset: function () { try { localStorage.removeItem(SEEN_KEY); } catch (e) {} } };
})();
