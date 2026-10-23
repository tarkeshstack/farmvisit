/* Farm Visit — on-screen guide.
   Flash cards that point at each tab, button and input, one screen at a time. Each screen's
   guide plays once, the first time it is opened, and the ? button replays it whenever needed. */
(function () {
  'use strict';
  var APP = window.FV_APP || 'form';
  var SEEN_KEY = 'fv_tour_seen_v2';

  /* ---------- the cards ----------
     sel: a CSS selector, a list of them (first visible wins), or 'text:<tag>:<words>'.
     A card whose target is missing or hidden is skipped, so one list fits phone and desktop;
     unless: skip the card when that other element is showing. */
  var HELP = { sel: '#fvhelp', t: 'Phir se dekhna hai?', d: 'Kabhi bhi ? dabaiye, is screen ki guide dobara chal jayegi.' };
  var REPORTS = [
    { sel: '[data-rc=page][data-arg=dash]', t: 'Dashboard', d: 'Chune hue visits ke main numbers aur graphs yahan dikhte hain.' },
    { sel: '[data-rc=page][data-arg=findings]', t: 'Findings', d: 'Visits se nikle saare khule kaam, unki due date ke saath. Late wale alag se dikhte hain.' },
    { sel: '.rmain [data-rc=menu][aria-expanded]', unless: '#rside .opt[data-rc=period]', t: 'Filters aur pages', d: 'Ise kholiye: Dashboard ya Findings chuniye, aur period, farms, bird type aur auditor select kijiye. Download bhi isi ke andar hai.' },
    { sel: '#rside .opt[data-rc=period]', t: 'Filters', d: 'Period, farms, bird type aur auditor chuniye. Har graph aur number inhi filters ke hisaab se badalta hai.' },
    { sel: '#rside [data-rc=farmall]', t: 'Farms', d: 'Saare farms dekhiye, ya kuch farms tap karke sirf unki tulna kijiye.' },
    { sel: '#rside [data-rc=agg]', t: 'Kaise compare karein', d: 'Har farm ki average, latest, sabse zyada ya sabse kam reading.' },
    { sel: '.gtabs', t: 'Report tabs', d: 'Ek baar mein ek report dekhiye, ya Show all dabaiye.' },
    { sel: '[data-rc=cm]', t: 'Reading chips', d: 'Graph mein kaunsi reading dikhe, yeh chuniye, jaise total mortality ya livability.' },
    { sel: '#rside [data-rc=pdf]', t: 'Download', d: 'Sab kuch PDF report ke roop mein save kijiye, ya Excel ke liye CSV.' },
    HELP
  ];
  var TOURS = {
    'form:entry': [
      { t: 'Farm Visit mein swagat hai', d: 'Visit form ka ek minute ka tour. Har hissa dekhne ke liye Aage dabaiye, ya pata hai to Chhodo.' },
      { sel: '[data-rc=view][data-arg=entry]', t: 'Visit data', d: 'Visit ki saari jaankari yahan bhariye: farm, flock, feed, growth, audit checks aur signature.' },
      { sel: '[data-rc=view][data-arg=live]', t: 'Live readings', d: 'Jaise-jaise aap bharte hain, score aur readings apne aap ban jaati hain: hara, peela ya laal, target ke hisaab se.' },
      { sel: '[data-rc=view][data-arg=reports]', t: 'Reports', d: 'Saare visits ke graphs aur findings, farms aur tareekh ke filters ke saath.' },
      { sel: '#rail', t: 'Section bar', d: 'Seedha Visit, Flock, Feed, Growth, Audit, Custom ya Sign par jaiye. Scroll karte waqt yeh saath rehta hai.' },
      { sel: '#s0 .hero', t: 'Visit card', d: 'Chuna hua farm aur uska score anda dikhata hai. Jitni bhari zardi, utna achha score.' },
      { sel: '[data-date=date]', t: 'Visit ki tareekh', d: 'Aaj ki tareekh pehle se bhari hai. Doosri tareekh ke liye tap kijiye.' },
      { sel: '[data-list=purpose]', t: 'Purpose', d: 'Tap karke visit ka kaaran chuniye, jaise routine audit ya follow-up.' },
      { sel: '[data-list=farmer]', t: 'Farmer aur farm', d: 'Tap karke list se chuniye; farm, location aur phone apne aap bhar jayenge. Naya farm? “Add a new farm…” chuniye.' },
      { sel: '#s1 .stt', t: 'Flock', d: 'Pehle Layer ya Broiler chuniye. Fir form sirf usi bird type ke fields dikhata hai.' },
      { sel: '[data-num]', t: 'Number tiles', d: 'Number bharne ke liye tile par tap kijiye. Scroll wheel ya keypad unit ke saath khulta hai. Style ⚙ Settings → Number entry mein badliye.' },
      { sel: '#s4 .stt', t: 'Audit checks', d: 'Farm par jo dikhe use giniye aur bhariye. Har check audit score mein judta hai.' },
      { sel: '#sgA', t: 'Signature', d: 'Auditor aur farmer yahan ungli se sign karte hain. Dobara sign ke liye Clear dabaiye.' },
      { sel: '[data-act=savevisit]', t: 'Save visit', d: 'Turant isi phone mein save hota hai, aur internet milte hi Google Sheet mein chala jata hai. Signal nahi? Baad mein apne aap sync ho jayega.' },
      { sel: '#eggb', t: 'Score anda', d: 'Is visit ki har reading dekhne ke liye kabhi bhi ande par tap kijiye.' },
      { sel: '[data-act=history]', t: 'Saved reports', d: 'Aapke save kiye visits. PDF report kholiye, visit edit kijiye, dohraiye, ya naya shuru kijiye.' },
      { sel: '#langb', t: 'Bhasha', d: 'English, Hinglish aur Hindi ke beech badliye.' },
      { sel: '[data-act=settings]', t: 'Settings', d: 'Number entry ka style, password badalna, backup aur sign out.' },
      HELP
    ],
    'form:live': [
      { sel: '[data-rc=lpto]', t: 'Reading groups', d: 'Audit scorecard aur har reading group ke beech badliye, ya Show all dabaiye.' },
      { sel: '#main .stt', t: 'Scorecard', d: 'Har check aur uske points. Laal wale sabse zyada points kaat-te hain, unhe pehle theek karwaiye.' },
      { sel: '[data-rc=lpnext]', t: 'Aage aur peeche', d: 'Groups ko ek-ek karke dekhiye.' },
      HELP
    ],
    'form:reports': REPORTS,
    'reports:reports': [{ t: 'Reports mein swagat hai', d: 'Har farm visit ke graphs aur findings, sirf dekhne ke liye. Chaliye ek nazar daalte hain.' }].concat(REPORTS),
    'admin:overview': [
      { t: 'Admin console mein swagat hai', d: 'Auditor kya bharenge yeh set kijiye, farms aur logon ko manage kijiye, aur har visit dekhiye. Chaliye ek nazar daalte hain.' },
      { sel: '#nav', t: 'Menu', d: 'Har section app ka ek hissa sambhalta hai. Har section pehli baar kholne par apni chhoti guide dikhata hai.' },
      { sel: 'text:h2:Farms, weakest first', t: 'Kamzor farms pehle', d: 'Jin farms par sabse zyada dhyan chahiye woh upar hain, unke latest aur average score ke saath.' },
      { sel: 'text:h2:Download everything', t: 'Sab download kijiye', d: 'Saare visits aur readings Excel ke liye CSV mein, ya poora backup.' },
      { sel: ['#nav a[href="index.html"]', '#top a[href="index.html"]'], t: 'Doosre apps', d: 'Usi sign-in se visit form ya reports par jaiye.' },
      HELP
    ],
    'admin:visits': [
      { sel: '#vq', t: 'Visit dhoondhiye', d: 'Farm, farmer, auditor ya visit number se visit dhoondhiye.' },
      { sel: '[data-act=vdel]', t: 'Visit delete', d: 'Visit sabke liye hat jata hai. Yeh sirf admin kar sakte hain.' }
    ],
    'admin:metrics': [
      { sel: '[data-act=ty]', t: 'Bird type', d: 'Layer aur Broiler ki readings alag hain. Set karne ke liye ek chuniye.' },
      { sel: 'input[data-tg=kpi]', t: 'Dikhana ya chhupana', d: 'Tick hataiye to woh reading visit form aur reports se chhup jayegi.' },
      { sel: '[data-act=lim]', t: 'Limits', d: 'Apne farms ke hisaab se reading ki hari, peeli aur laal limit set kijiye.' }
    ],
    'admin:allkpis': [
      { sel: '#aq', t: 'Search', d: 'Kisi bhi reading ya check ko naam se dhoondhiye.' },
      { sel: '#ak', t: 'Kism', d: 'Built-in readings, audit checks ya apne metrics mein se chuniye.' },
      { sel: '[data-act=allon]', t: 'Sab ya koi nahi', d: 'Ek bird type ke saare KPI ek saath on ya off kijiye.' }
    ],
    'admin:fields': [
      { sel: '[data-act=fnew]', t: 'Naya field', d: 'Visit form mein apna sawaal jodiye: number, haan/na, choice ya text.' },
      { sel: '[data-act=fedit]', t: 'Edit aur kram', d: 'Field badliye, ya teer se upar-neeche kijiye.' }
    ],
    'admin:kpis': [
      { sel: '[data-act=knew]', t: 'Naya metric', d: 'Form ke fields se formula banakar apni reading banaiye, apne targets ke saath.' },
      { sel: '[data-act=kedit]', t: 'Metric edit', d: 'Formula, unit ya targets badliye.' }
    ],
    'admin:farms': [
      { sel: '[data-act=fnew2]', t: 'Naya farm', d: 'Farmer, location, phone aur bird type ke saath farm jodiye. Auditor bhi form se farm jod sakte hain.' },
      { sel: '[data-act=fimport]', t: 'List import', d: 'Farms ki poori list ek saath paste kijiye.' },
      { sel: '#fq', t: 'Farm dhoondhiye', d: 'Naam, farmer ya jagah se farm dhoondhiye.' },
      { sel: '[data-act=fedit2]', t: 'Edit ya archive', d: 'Farm badalna ya archive karna sirf admin kar sakte hain. Archive farm ke visits bane rehte hain.' }
    ],
    'admin:team': [
      { sel: '[data-act=unew]', t: 'Naya vyakti', d: 'Username ya email se auditor, viewer ya admin jodiye. Unhe bhejne ke liye ek temporary password milta hai.' },
      { sel: 'select[data-role]', t: 'Role', d: 'Auditor visit bharte hain, viewer sirf reports dekhte hain, admin sab sambhalte hain.' },
      { sel: '[data-act=ureset]', t: 'Password reset', d: 'Us vyakti ko naya temporary password deta hai.' },
      { sel: '[data-act=utog]', t: 'Deactivate', d: 'Us vyakti ka sign-in band ho jata hai. Unke visits bane rehte hain.' }
    ],
    'admin:org': [
      { sel: '#o_n', t: 'Organisation ka naam', d: 'Sign-in screen aur har PDF report par dikhta hai.' },
      { sel: '#o_l', t: 'Default bhasha', d: 'Visit form isi bhasha mein khulta hai. Har vyakti fir bhi badal sakta hai.' },
      { sel: '#o_s', t: 'Auditor sign-up', d: 'Auditor khud username aur password se account bana sakein, ya sirf admin log jodein.' },
      { sel: '[data-act=osave]', t: 'Save', d: 'Organisation ki settings sabke liye save karta hai.' },
      { sel: '[data-act=sheet]', t: 'Aapki Google Sheet', d: 'Woh sheet kholiye jismein saara data hai.' },
      { sel: 'text:h2:Links for your team', t: 'Team ke liye links', d: 'Visit form aur reports ke taiyaar links. Inhe apne logon ko bhejiye.' }
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
    el.insertAdjacentHTML('beforeend', '<div class="fvt-sp"></div><div class="fvt-cd" aria-live="polite"><p class="fvt-st"></p><h3></h3><p class="fvt-tx"></p><div class="fvt-dt"></div><div class="fvt-bt"><button class="fvt-sk" type="button">Chhodo</button><span class="fvt-gr"></span><button class="fvt-bk" type="button">Peeche</button><button class="fvt-nx" type="button">Aage</button></div></div>');
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
    el.querySelector('.fvt-st').textContent = 'Step ' + (i + 1) + ' / ' + steps.length;
    el.querySelector('h3').textContent = s.t;
    el.querySelector('.fvt-tx').textContent = s.d;
    el.querySelector('.fvt-dt').innerHTML = steps.map(function (_, j) { return '<i class="' + (j === i ? 'fvt-on' : '') + '"></i>'; }).join('');
    el.querySelector('.fvt-bk').style.visibility = i ? 'visible' : 'hidden';
    el.querySelector('.fvt-nx').textContent = i === steps.length - 1 ? 'Samajh gaya' : 'Aage';
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
      b = document.createElement('a'); b.href = '#'; b.textContent = 'Guide (madad)'; b.style.marginLeft = '10px';
      out.parentNode.insertBefore(b, out.nextSibling);
    } else {
      var h = document.querySelector('[data-act=history]'); if (!h) return;
      b = document.createElement('button'); b.type = 'button'; b.className = h.className + ' fvhq'; b.textContent = '?';
      h.parentNode.insertBefore(b, h);
    }
    b.id = 'fvhelp'; b.setAttribute('aria-label', 'Is screen ki guide dikhaiye'); b.title = 'Guide';
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
