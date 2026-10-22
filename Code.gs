/* === PART 1 of 2: shared engine (metrics, formulas, validation) === */
/* Shared between the server, the farm visit app and the admin panel.
   Single source of truth for: built-in KPI catalogue, baseline (threshold) engine,
   input-field catalogue and the safe formula engine used by custom KPIs. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FV = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

  /* ---------- groups ---------- */
  const G1 = 'Mortality and health', G2 = 'Growth and weight', G3 = 'Feed and water',
        G4 = 'Egg production', G5 = 'Costs and profit', G6 = 'House conditions',
        GA = 'Audit checks', GC = 'Custom metrics';
  const GROUPS = [G1, G2, G3, G4, G5, G6];
  const TYPES = ['Broiler', 'Layer'];

  /* ---------- built-in KPI catalogue (labels exactly as produced by kpis()) ---------- */
  const BUILTIN = [
    [G1, 'Total mortality'], [G1, 'Livability'], [G1, 'Deaths in the last 7 days'],
    [G2, 'Body weight'], [G2, 'Weight against standard'], [G2, 'Daily gain, whole life'],
    [G2, 'Gained since last weighing'], [G2, 'Recent daily gain'], [G2, 'Uniformity'], [G2, 'EPEF', 'Broiler'],
    [G3, 'Feed per bird per day'], [G3, 'Feed against standard'], [G3, 'Feed per bird to date'],
    [G3, 'Feed per dozen eggs', 'Layer'], [G3, 'FCR, kg feed per kg egg', 'Layer'],
    [G3, 'FCR, feed per kg of bird', 'Broiler'], [G3, 'Water per bird per day'],
    [G3, 'Water to feed ratio'], [G3, 'Feed stock left'], [G3, 'Stocking density'],
    [G4, 'Laying rate, hen-day', 'Layer'], [G4, 'Laying rate against standard', 'Layer'],
    [G4, 'Broken eggs', 'Layer'], [G4, 'Egg mass per hen per day', 'Layer'], [G4, 'Eggs per hen housed', 'Layer'],
    [G5, 'Cost per egg', 'Layer'], [G5, 'Feed cost per dozen', 'Layer'], [G5, 'Feed share of cost', 'Layer'],
    [G5, 'Profit per day', 'Layer'], [G5, 'Profit margin', 'Layer'],
    [G5, 'Feed cost per bird per day', 'Broiler'], [G5, 'Feed cost per kg of bird', 'Broiler'], [G5, 'Total cost per day', 'Broiler'],
    [G6, 'House temperature'], [G6, 'Humidity']
  ].map(([g, k, t]) => ({ g, k, t: t || null }));

  /* audit checks, in the order the app shows them */
  const AUDIT_ITEMS = [
    ['Biosecurity', 'Biosecurity measures in place'], ['Biosecurity', 'Rodent sightings during visit'], ['Biosecurity', 'Dead birds left in the shed'],
    ['Housing', 'House temperature'], ['Housing', 'Humidity'], ['Housing', 'Ammonia level'], ['Housing', 'Litter moisture'], ['Housing', 'Stocking density'],
    ['Feed and water', 'Feed stock on hand'], ['Feed and water', 'Feed wastage'], ['Feed and water', 'Water to feed ratio'], ['Feed and water', 'Birds per drinker'],
    ['Health', 'Vaccines given on time'], ['Health', 'Medicine withdrawal breaches'], ['Health', 'Sick birds isolated'], ['Health', 'Total mortality'],
    ['Records', 'Days of records missing, last 7'], ['Records', 'Purchases without a bill']
  ].map(([g, k]) => ({ g, k }));

  /* ---------- fields usable as formula variables ---------- */
  const FIELDS = [
    ['age', 'Flock age', 'days'], ['placed', 'Birds placed', 'birds'], ['alive', 'Birds alive today', 'birds'],
    ['mortw', 'Deaths in last 7 days', 'birds'], ['area', 'Shed floor area', 'm²'], ['temp', 'House temperature', '°C'],
    ['hum', 'Relative humidity', '%'], ['feed', 'Feed used per day', 'kg'], ['stdfeed', 'Standard feed', 'g/bird/day'],
    ['cumfeed', 'Feed eaten per bird to date', 'kg'], ['cumfeedstd', 'Standard feed to date', 'kg/bird'],
    ['water', 'Water used per day', 'litres'], ['stock', 'Feed stock on hand', 'kg'], ['price', 'Feed price per kg', 'currency'],
    ['other', 'Other costs per day', 'currency'], ['eggprice', 'Egg selling price', 'currency'],
    ['chickwt', 'Day-old chick weight', 'g'], ['wt', 'Average body weight today', 'g'], ['wtstd', 'Breed standard weight', 'g'],
    ['stdgain', 'Standard daily gain', 'g/day'], ['prevwt', 'Previous weighing', 'g'], ['prevdays', 'Days since previous weighing', 'days'],
    ['unif', 'Uniformity', '%'], ['eggs', 'Eggs per day', 'eggs'], ['broken', 'Broken eggs per day', 'eggs'],
    ['eggwt', 'Average egg weight', 'g'], ['stdlay', 'Standard laying rate', '%'], ['cumeggs', 'Total eggs laid to date', 'eggs'],
    ['bio', 'Biosecurity measures in place', 'of 6'], ['rodents', 'Rodent sightings', 'count'], ['carcass', 'Dead birds left in shed', 'birds'],
    ['nh3', 'Ammonia level', 'ppm'], ['litter', 'Litter moisture', '%'], ['waste', 'Feed wastage', '%'], ['bpd', 'Birds per drinker', 'birds'],
    ['vdue', 'Vaccine doses due', 'doses'], ['vdone', 'Vaccine doses given', 'doses'], ['wdraw', 'Withdrawal breaches', 'count'],
    ['sick', 'Sick birds seen', 'birds'], ['isol', 'Sick birds isolated', 'birds'], ['gaps', 'Days of records missing', 'days'], ['nobill', 'Purchases without a bill', 'count']
  ].map(([k, l, u]) => ({ k, l, u }));

  /* ---------- baseline (threshold) registry ---------- */
  const bird = (d, x) => num(d.wt) > 0 ? x / (num(d.wt) / 1000) : null;
  const eggK = div => (d, x) => num(d.eggwt) > 0 ? x / div / (num(d.eggwt) / 1000) : null;
  const KB = [
    { g: G1, k: 'Total mortality', dir: 'max', u: ' %', d: { Broiler: [4, 7], Layer: [5, 8] } },
    { g: G1, k: 'Livability', dir: 'min', u: ' %', d: { Broiler: [96, 93], Layer: [95, 92] } },
    { g: G1, k: 'Deaths in the last 7 days', dir: 'max', u: ' %', d: { x: [.5, 1] } },
    { g: G2, k: 'Weight against standard', dir: 'min', u: ' %', d: { x: [95, 90] } },
    { g: G2, k: 'Daily gain, whole life', dir: 'min', u: ' % of standard', d: { x: [95, 90] } },
    { g: G2, k: 'Uniformity', dir: 'min', u: ' %', d: { x: [80, 70] } },
    { g: G2, t: 'Broiler', k: 'EPEF', dir: 'min', u: '', d: { x: [300, 250] } },
    { g: G3, k: 'Feed per bird per day', dir: 'band', u: ' % of standard', d: { x: [95, 105, 90, 110] } },
    { g: G3, k: 'Feed per bird to date', dir: 'band', u: ' % of standard', d: { x: [95, 105, 90, 110] } },
    { g: G3, t: 'Layer', k: 'Feed per dozen eggs', dir: 'max', u: ' kg', d: { x: [1.6, 1.9] } },
    { g: G3, t: 'Layer', k: 'FCR, kg feed per kg egg', dir: 'max', u: ' kg feed per kg egg', d: { x: [2.3, 2.7] } },
    { g: G3, t: 'Broiler', k: 'FCR, feed per kg of bird', dir: 'max', u: ' kg feed per kg bird', d: { x: [1.8, 2.1] } },
    { g: G3, k: 'Water per bird per day', dir: 'band', u: ' ml', d: null, kg: { u: ' ml per kg of bird', f: bird } },
    { g: G3, k: 'Water to feed ratio', dir: 'band', u: ' : 1', d: { x: [1.8, 2.4, 1.5, 2.8] } },
    { g: G3, k: 'Feed stock left', dir: 'min', u: ' days', d: { x: [7, 3] } },
    { g: G3, k: 'Stocking density', dir: 'max', u: ' birds/m²', d: { Broiler: [10, 12], Layer: [7, 9] } },
    { g: G4, t: 'Layer', k: 'Laying rate, hen-day', dir: 'min', u: ' %', d: { x: [80, 65] } },
    { g: G4, t: 'Layer', k: 'Laying rate against standard', dir: 'min', u: ' %', d: { x: [95, 90] } },
    { g: G4, t: 'Layer', k: 'Broken eggs', dir: 'max', u: ' %', d: { x: [2, 4] } },
    { g: G4, t: 'Layer', k: 'Egg mass per hen per day', dir: 'min', u: ' g', d: { x: [48, 40] } },
    { g: G5, t: 'Broiler', k: 'Feed cost per bird per day', dir: 'max', u: '¤', d: null, kg: { u: '¤ per kg of bird', f: bird } },
    { g: G5, t: 'Broiler', k: 'Feed cost per kg of bird', dir: 'max', u: '¤', d: null },
    { g: G5, t: 'Broiler', k: 'Total cost per day', dir: 'max', u: '¤', d: null },
    { g: G5, t: 'Layer', k: 'Cost per egg', dir: 'max', u: '¤', d: null, kg: { u: '¤ per kg of egg', f: eggK(1) } },
    { g: G5, t: 'Layer', k: 'Feed cost per dozen', dir: 'max', u: '¤', d: null, kg: { u: '¤ per kg of egg', f: eggK(12) } },
    { g: G5, t: 'Layer', k: 'Feed share of cost', dir: 'band', u: ' %', d: { x: [55, 72, 45, 80] } },
    { g: G5, t: 'Layer', k: 'Profit margin', dir: 'min', u: ' %', d: { x: [15, 0] } },
    { g: G6, k: 'House temperature', dir: 'band', u: ' °C', ub: { Broiler: ' °C from target', Layer: ' °C' }, d: { Layer: [18, 27, 15, 30], Broiler: [-2, 2, -4, 4] } },
    { g: G6, k: 'Humidity', dir: 'band', u: ' %', d: { x: [50, 70, 40, 80] } },
    { g: GA, k: 'Biosecurity measures in place', dir: 'min', u: ' of 6', d: { x: [5, 3] } },
    { g: GA, k: 'Rodent sightings during visit', dir: 'max', u: '', d: { x: [0, 2] } },
    { g: GA, k: 'Dead birds left in the shed', dir: 'max', u: '', d: { x: [0, 2] } },
    { g: GA, k: 'Ammonia level', dir: 'max', u: ' ppm', d: { x: [10, 25] } },
    { g: GA, k: 'Litter moisture', dir: 'max', u: ' %', d: { x: [30, 40] } },
    { g: GA, k: 'Feed wastage', dir: 'max', u: ' %', d: { x: [3, 6] } },
    { g: GA, k: 'Birds per drinker', dir: 'max', u: '', d: { x: [10, 15] } },
    { g: GA, k: 'Vaccines given on time', dir: 'min', u: ' %', d: { x: [100, 85] } },
    { g: GA, k: 'Medicine withdrawal breaches', dir: 'max', u: '', d: { x: [0, 0] } },
    { g: GA, k: 'Sick birds isolated', dir: 'min', u: ' %', d: { x: [90, 60] } },
    { g: GA, k: 'Days of records missing, last 7', dir: 'max', u: ' days', d: { x: [0, 1] } },
    { g: GA, k: 'Purchases without a bill', dir: 'max', u: '', d: { x: [0, 2] } }
  ];
  const SPEC = {}; KB.forEach(x => SPEC[x.k] = x);
  const AL = { 'Feed against standard': 'Feed per bird per day', 'Recent daily gain': 'Daily gain, whole life' };
  const tyOf = t => t === 'Layer' ? 'Layer' : 'Broiler';
  const nV = sp => sp.dir === 'band' ? 4 : 2;
  const mkFn = (dir, v) => dir === 'max' ? (x => x <= v[0] ? 'ok' : x <= v[1] ? 'warn' : 'bad')
    : dir === 'min' ? (x => x >= v[0] ? 'ok' : x >= v[1] ? 'warn' : 'bad')
    : (x => x >= v[0] && x <= v[1] ? 'ok' : x >= v[2] && x <= v[3] ? 'warn' : 'bad');
  const api = { cur: () => '₹' };
  const fu = (x, u) => u[0] === '¤' ? api.cur() + x + u.slice(1) : x + u;
  function btxt(dir, v, u) {
    return dir === 'max' ? '≤ ' + fu(v[0], u) : dir === 'min' ? '≥ ' + fu(v[0], u)
      : (u[0] === '¤' ? api.cur() : '') + v[0] + '–' + fu(v[1], u);
  }
  const okArr = (a, n) => Array.isArray(a) && a.length === n && a.every(x => typeof x === 'number' && isFinite(x));
  const blGet = (BL, ty, k) => (BL && BL[ty + '|' + k]) || {};
  function eff(sp, type, d, BL) {
    const ty = tyOf(type), o = blGet(BL, ty, sp.k), kg = !!(sp.kg && o.kg), arr = kg ? o.vk : o.v;
    let v = null, custom = false;
    if (okArr(arr, nV(sp))) { v = arr; custom = true; } else if (!kg && sp.d) v = sp.d[ty] || sp.d.x || null;
    let fn = v ? mkFn(sp.dir, v) : null;
    if (fn && kg) { const f0 = fn; fn = x => { const y = sp.kg.f(d || {}, x); return y == null || !isFinite(y) ? 'na' : f0(y); }; }
    const u = kg ? sp.kg.u : (sp.ub && sp.ub[ty]) || sp.u;
    return { v, fn, custom, kg, text: kg && !v ? 'Set a per kg target' : custom ? 'Your target: ' + btxt(sp.dir, v, u) : '' };
  }
  /* validate and clean a baselines object coming from an admin */
  function cleanBaselines(BL) {
    const out = {};
    if (!BL || typeof BL !== 'object') return out;
    for (const key of Object.keys(BL)) {
      const i = key.indexOf('|'); if (i < 0) continue;
      const ty = key.slice(0, i), k = key.slice(i + 1), sp = SPEC[k];
      if (!sp || !TYPES.includes(ty)) continue;
      const o = BL[key] || {}, n = nV(sp), r = {};
      if (okArr(o.v, n)) r.v = o.v.slice();
      if (sp.kg) { if (o.kg) r.kg = true; if (okArr(o.vk, n)) r.vk = o.vk.slice(); }
      if (r.v || r.vk || r.kg) out[key] = r;
    }
    return out;
  }

  /* ---------- formula engine (no eval) ---------- */
  const FN = {
    min: { n: [1, 9], f: (...a) => Math.min(...a) }, max: { n: [1, 9], f: (...a) => Math.max(...a) },
    abs: { n: [1, 1], f: Math.abs }, sqrt: { n: [1, 1], f: Math.sqrt },
    round: { n: [1, 2], f: (x, n) => { const p = Math.pow(10, n || 0); return Math.round(x * p) / p; } },
    pct: { n: [2, 2], f: (a, b) => a / b * 100 },
    avg: { n: [1, 9], f: (...a) => a.reduce((s, x) => s + x, 0) / a.length }
  };
  function tokenize(src) {
    const t = []; let i = 0; const s = String(src);
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      let m;
      if ((m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)))) { t.push({ t: 'n', v: parseFloat(m[1]) }); i += m[1].length; continue; }
      if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i)))) { t.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
      if ((m = /^(>=|<=|==|!=|&&|\|\|)/.exec(s.slice(i)))) { t.push({ t: 'op', v: m[1] }); i += 2; continue; }
      if ('+-*/(),<>!'.includes(c)) { t.push({ t: 'op', v: c }); i++; continue; }
      throw new Error('Unexpected character "' + c + '"');
    }
    return t;
  }
  function parse(src) {
    const toks = tokenize(src); let p = 0;
    const peek = () => toks[p], eat = v => { const k = toks[p]; if (k && k.t === 'op' && k.v === v) { p++; return true; } return false; };
    function or() { let l = and(); while (peek() && peek().t === 'op' && peek().v === '||') { p++; l = { k: 'b', o: '||', l, r: and() }; } return l; }
    function and() { let l = cmp(); while (peek() && peek().t === 'op' && peek().v === '&&') { p++; l = { k: 'b', o: '&&', l, r: cmp() }; } return l; }
    function cmp() { let l = add(); const k = peek(); if (k && k.t === 'op' && ['>', '<', '>=', '<=', '==', '!='].includes(k.v)) { p++; l = { k: 'b', o: k.v, l, r: add() }; } return l; }
    function add() { let l = mul(); for (;;) { const k = peek(); if (k && k.t === 'op' && (k.v === '+' || k.v === '-')) { p++; l = { k: 'b', o: k.v, l, r: mul() }; } else return l; } }
    function mul() { let l = un(); for (;;) { const k = peek(); if (k && k.t === 'op' && (k.v === '*' || k.v === '/')) { p++; l = { k: 'b', o: k.v, l, r: un() }; } else return l; } }
    function un() { if (eat('-')) return { k: 'u', o: '-', e: un() }; if (eat('!')) return { k: 'u', o: '!', e: un() }; return atom(); }
    function atom() {
      const k = toks[p++];
      if (!k) throw new Error('The formula ends too early');
      if (k.t === 'n') return { k: 'n', v: k.v };
      if (k.t === 'id') {
        if (eat('(')) {
          const f = FN[k.v] || (k.v === 'if' ? { n: [3, 3] } : null);
          if (!f) throw new Error('Unknown function "' + k.v + '"');
          const args = [];
          if (!eat(')')) { do args.push(or()); while (eat(',')); if (!eat(')')) throw new Error('Missing ")"'); }
          if (args.length < f.n[0] || args.length > f.n[1]) throw new Error(k.v + ' needs ' + (f.n[0] === f.n[1] ? f.n[0] : f.n[0] + ' to ' + f.n[1]) + ' values');
          return { k: 'f', n: k.v, a: args };
        }
        return { k: 'v', n: k.v };
      }
      if (k.t === 'op' && k.v === '(') { const e = or(); if (!eat(')')) throw new Error('Missing ")"'); return e; }
      throw new Error('Unexpected "' + k.v + '"');
    }
    const ast = or();
    if (p < toks.length) throw new Error('Unexpected "' + toks[p].v + '"');
    return ast;
  }
  function vars(ast, out) {
    out = out || new Set();
    if (ast.k === 'v') out.add(ast.n);
    else if (ast.k === 'b') { vars(ast.l, out); vars(ast.r, out); }
    else if (ast.k === 'u') vars(ast.e, out);
    else if (ast.k === 'f') ast.a.forEach(a => vars(a, out));
    return out;
  }
  /* get(name) returns a number, or null when the value is missing. Result: number or null. */
  function evaluate(ast, get) {
    const E = n => {
      switch (n.k) {
        case 'n': return n.v;
        case 'v': { const x = get(n.n); if (x == null || !isFinite(x)) throw MISS; return x; }
        case 'u': { const x = E(n.e); return n.o === '-' ? -x : (x ? 0 : 1); }
        case 'b': {
          if (n.o === '&&') return E(n.l) && E(n.r) ? 1 : 0;
          if (n.o === '||') return E(n.l) || E(n.r) ? 1 : 0;
          const a = E(n.l), b = E(n.r);
          switch (n.o) {
            case '+': return a + b; case '-': return a - b; case '*': return a * b;
            case '/': if (b === 0) throw MISS; return a / b;
            case '>': return a > b ? 1 : 0; case '<': return a < b ? 1 : 0; case '>=': return a >= b ? 1 : 0;
            case '<=': return a <= b ? 1 : 0; case '==': return a === b ? 1 : 0; case '!=': return a !== b ? 1 : 0;
          }
          return null;
        }
        case 'f':
          if (n.n === 'if') return E(n.a[0]) ? E(n.a[1]) : E(n.a[2]);
          return FN[n.n].f(...n.a.map(E));
      }
      return null;
    };
    const MISS = { miss: true };
    try { const r = E(ast); return isFinite(r) ? r : null; } catch (e) { if (e === MISS) return null; throw e; }
  }
  const cache = new Map();
  function compile(src) { let a = cache.get(src); if (!a) { a = parse(src); if (cache.size > 500) cache.clear(); cache.set(src, a); } return a; }

  /* ---------- org config: defaults, validation, helpers ---------- */
  const emptyConfig = () => ({ v: 1, disabled: { Broiler: [], Layer: [], audit: [] }, baselines: {}, fields: [], kpis: [] });
  const CF_TYPES = ['number', 'yesno', 'choice', 'text'];
  const reserved = new Set(FIELDS.map(f => f.k));
  const builtinLabels = new Set(BUILTIN.map(b => b.k).concat(AUDIT_ITEMS.map(a => a.k)));
  /* variables a formula may use: built-in fields + custom number / yes-no fields */
  function formulaVars(cfg) {
    const list = FIELDS.map(f => ({ k: f.k, l: f.l, u: f.u, custom: false }));
    ((cfg && cfg.fields) || []).forEach(f => { if (f.type === 'number' || f.type === 'yesno') list.push({ k: f.id, l: f.label, u: f.unit || '', custom: true }); });
    return list;
  }
  function validateConfig(input) {
    const errors = [], cfg = emptyConfig();
    const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
    const inp = input && typeof input === 'object' ? input : {};
    /* disabled lists */
    const dis = inp.disabled || {};
    for (const ty of TYPES) {
      const valid = new Set(BUILTIN.filter(b => !b.t || b.t === ty).map(b => b.k));
      cfg.disabled[ty] = [...new Set((Array.isArray(dis[ty]) ? dis[ty] : []).filter(k => valid.has(k)))];
    }
    const av = new Set(AUDIT_ITEMS.map(a => a.k));
    cfg.disabled.audit = [...new Set((Array.isArray(dis.audit) ? dis.audit : []).filter(k => av.has(k)))];
    cfg.baselines = cleanBaselines(inp.baselines);
    /* custom fields */
    const ids = new Set();
    (Array.isArray(inp.fields) ? inp.fields : []).slice(0, 40).forEach((f, i) => {
      const id = str(f && f.id, 32), label = str(f && f.label, 60);
      if (!/^cf_[a-z][a-z0-9_]{0,27}$/.test(id)) { errors.push('Field ' + (i + 1) + ': id must look like cf_name'); return; }
      if (ids.has(id)) { errors.push('Field id "' + id + '" is used twice'); return; }
      if (!label) { errors.push('Field ' + id + ': add a name'); return; }
      const type = CF_TYPES.includes(f.type) ? f.type : 'number';
      const o = { id, label, type, unit: str(f.unit, 16), types: TYPES.filter(t => !Array.isArray(f.types) || f.types.includes(t)), required: !!f.required, section: str(f.section, 40) };
      if (!o.types.length) o.types = TYPES.slice();
      if (type === 'number') {
        o.dec = Math.max(0, Math.min(4, parseInt(f.dec, 10) || 0));
        o.min = isFinite(+f.min) && f.min !== '' && f.min != null ? +f.min : 0;
        o.max = isFinite(+f.max) && f.max !== '' && f.max != null ? +f.max : 100000;
        if (o.max <= o.min) { errors.push('Field ' + label + ': max must be above min'); return; }
      }
      if (type === 'choice') {
        o.choices = [...new Set((Array.isArray(f.choices) ? f.choices : []).map(c => str(c, 40)).filter(Boolean))].slice(0, 20);
        if (o.choices.length < 2) { errors.push('Field ' + label + ': add at least two choices'); return; }
      }
      ids.add(id); cfg.fields.push(o);
    });
    /* custom KPIs */
    const vset = new Set(formulaVars(cfg).map(v => v.k)), kids = new Set(), klabels = new Set();
    (Array.isArray(inp.kpis) ? inp.kpis : []).slice(0, 40).forEach((k, i) => {
      const id = str(k && k.id, 32), label = str(k && k.label, 60), formula = str(k && k.formula, 400);
      if (!/^ck_[a-z][a-z0-9_]{0,27}$/.test(id)) { errors.push('Metric ' + (i + 1) + ': id must look like ck_name'); return; }
      if (kids.has(id)) { errors.push('Metric id "' + id + '" is used twice'); return; }
      if (!label) { errors.push('Metric ' + id + ': add a name'); return; }
      if (builtinLabels.has(label) || klabels.has(label.toLowerCase())) { errors.push('Metric name "' + label + '" is already used'); return; }
      let ast; try { ast = parse(formula); } catch (e) { errors.push(label + ': ' + e.message); return; }
      const unknown = [...vars(ast)].filter(v => !vset.has(v));
      if (unknown.length) { errors.push(label + ': unknown value ' + unknown.join(', ')); return; }
      const dir = ['none', 'max', 'min', 'band'].includes(k.dir) ? k.dir : 'none';
      const o = { id, label, formula, unit: str(k.unit, 24), dec: Math.max(0, Math.min(4, parseInt(k.dec, 10) || 0)), dir, group: str(k.group, 40) || GC,
        types: TYPES.filter(t => !Array.isArray(k.types) || k.types.includes(t)), off: !!k.off, per: k.unit && /^¤/.test(k.unit) ? 'currency' : '' };
      if (!o.types.length) o.types = TYPES.slice();
      if (dir !== 'none') {
        const n = dir === 'band' ? 4 : 2, v = Array.isArray(k.t) ? k.t.map(Number) : [];
        if (!okArr(v, n)) { errors.push(label + ': fill every limit box'); return; }
        const ordered = dir === 'max' ? v[0] <= v[1] : dir === 'min' ? v[0] >= v[1] : (v[2] <= v[0] && v[0] <= v[1] && v[1] <= v[3]);
        if (!ordered) { errors.push(label + ': limits are in the wrong order'); return; }
        o.t = v;
      }
      kids.add(id); klabels.add(label.toLowerCase()); cfg.kpis.push(o);
    });
    return { ok: !errors.length, errors, config: cfg };
  }
  /* evaluate one custom KPI for a visit. scope(name) -> number|null */
  function evalCustom(k, getRaw) {
    try { return evaluate(compile(k.formula), getRaw); } catch (e) { return null; }
  }
  const dirFn = k => k.dir === 'none' || !k.t ? null : mkFn(k.dir, k.t);

  api.constants = { G1, G2, G3, G4, G5, G6, GA, GC, GROUPS, TYPES, CF_TYPES };
  Object.assign(api, { num, BUILTIN, AUDIT_ITEMS, FIELDS, KB, SPEC, AL, tyOf, nV, mkFn, fu, btxt, eff, blGet, cleanBaselines,
    parse, compile, vars, evaluate, formulaVars, validateConfig, emptyConfig, evalCustom, dirFn, reserved });
  return api;
});


/* === PART 2 of 2: sheet backend === */
/* =====================================================================
   FARM VISIT — Google Sheets backend (Google Apps Script)
   One spreadsheet = one organisation. The three web apps (visit form,
   admin console, reports) all talk to this script, so they always read
   and write the same sheet.
   Deploy: Extensions > Apps Script > paste this file > Deploy > Web app
           (Execute as: Me, Who has access: Anyone).
   ===================================================================== */
'use strict';

var SCHEMA = {
  Settings:   ['key', 'value'],
  Users:      ['id', 'email', 'name', 'role', 'org_label', 'access', 'pw_salt', 'pw_hash', 'must_change', 'active', 'created_at', 'last_login'],
  Sessions:   ['token_hash', 'user_id', 'created_at', 'expires_at'],
  Farms:      ['id', 'farm', 'farmer', 'location', 'phone', 'type', 'notes', 'active', 'created_at', 'updated_at'],
  Visits:     ['id', 'visit_no', 'date', 'farm_id', 'farm', 'farmer', 'type', 'auditor', 'user_id', 'score', 'rating', 'kpis', 'data', 'created_at', 'updated_at'],
  Signatures: ['visit_id', 'sig_auditor', 'sig_farmer'],
  Blobs:      ['id', 'seq', 'chunk'],
  Audit:      ['at', 'user', 'action', 'detail']
};
var NUMERIC = { score: 1, seq: 1 };
var BOOL = { must_change: 1, active: 1 };
var CELL_MAX = 45000;        // Google Sheets allows 50,000 characters per cell
var SESSION_DAYS = 30;
var PW_ROUNDS = 400;
var ROLES = ['owner', 'admin', 'auditor', 'viewer'];
var FTYPES = ['Layer', 'Broiler'];

function HttpError(status, message, extra) { this.status = status; this.message = message; this.extra = extra || null; }

/* ---------------- small helpers ---------------- */
function nowIso() { return new Date().toISOString(); }
function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)); }
function toNum(v) { var n = Number(v); return isFinite(n) ? n : null; }
function validEmail(e) { return typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function validPassword(p) { return typeof p === 'string' && p.length >= 8 && p.length <= 200; }
function validUsername(e) { return typeof e === 'string' && /^[a-z0-9][a-z0-9._-]{2,39}$/.test(e); }
function validLogin(e) { return validEmail(e) || validUsername(e); }
function parseJson(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function hex(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) { var b = (bytes[i] + 256) % 256; s += (b < 16 ? '0' : '') + b.toString(16); } return s; }
function sha256(text) { return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)); }
function newToken() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }
function newId() { return Utilities.getUuid(); }
function tempPassword() {
  var a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789', s = '';
  for (var i = 0; i < 12; i++) s += a.charAt(Math.floor(Math.random() * a.length));
  return s;
}
function hashPw(pw, salt) {
  var h = salt + '|' + pw;
  for (var i = 0; i < PW_ROUNDS; i++) h = sha256(h + salt);
  return h;
}
function safeEq(a, b) { if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

/* ---------------- table layer over sheet tabs ---------------- */
var _ss = null, _tables = {};
function ss() { return _ss || (_ss = SpreadsheetApp.getActiveSpreadsheet()); }

function Table(name) {
  this.name = name; this.cols = SCHEMA[name];
  var sh = ss().getSheetByName(name);
  if (!sh) {
    sh = ss().insertSheet(name);
    sh.getRange(1, 1, 1, this.cols.length).setValues([this.cols]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), this.cols.length).setNumberFormat('@');   // keep dates and ids as plain text
    sh.getRange(1, 1, 1, this.cols.length).setFontWeight('bold');
  }
  this.sh = sh; this._rows = null;
}
Table.prototype._decode = function (row) {
  var o = {};
  for (var i = 0; i < this.cols.length; i++) {
    var c = this.cols[i], v = row[i];
    if (BOOL[c]) o[c] = String(v) === '1' || v === true;
    else if (NUMERIC[c]) o[c] = v === '' || v == null ? null : Number(v);
    else o[c] = v == null ? '' : String(v);
  }
  return o;
};
Table.prototype._encode = function (o) {
  var r = [];
  for (var i = 0; i < this.cols.length; i++) {
    var c = this.cols[i], v = o[c];
    if (BOOL[c]) r.push(v ? '1' : '0');
    else if (v == null) r.push('');
    else r.push(String(v));
  }
  return r;
};
Table.prototype.all = function () {
  if (this._rows) return this._rows;
  var n = this.sh.getLastRow(), out = [];
  if (n >= 2) {
    var vals = this.sh.getRange(2, 1, n - 1, this.cols.length).getValues();
    for (var i = 0; i < vals.length; i++) { var o = this._decode(vals[i]); o._row = i + 2; out.push(o); }
  }
  return (this._rows = out);
};
Table.prototype.find = function (fn) { var a = this.all(); for (var i = 0; i < a.length; i++) if (fn(a[i])) return a[i]; return null; };
Table.prototype.by = function (col, val) { return this.find(function (r) { return r[col] === val; }); };
Table.prototype.insert = function (o) {
  var row = this._encode(o), at = this.sh.getLastRow() + 1;
  this.sh.getRange(at, 1, 1, this.cols.length).setNumberFormat('@').setValues([row]);
  var rec = this._decode(row); rec._row = at;
  if (this._rows) this._rows.push(rec);
  return rec;
};
Table.prototype.save = function (rec) {
  var row = this._encode(rec);
  this.sh.getRange(rec._row, 1, 1, this.cols.length).setNumberFormat('@').setValues([row]);
  return rec;
};
Table.prototype.update = function (rec, patch) { for (var k in patch) rec[k] = patch[k]; return this.save(rec); };
Table.prototype.removeWhere = function (fn) {
  var keep = [], gone = 0, a = this.all();
  for (var i = 0; i < a.length; i++) { if (fn(a[i])) gone++; else keep.push(this._encode(a[i])); }
  if (!gone) return 0;
  var n = this.sh.getLastRow();
  if (n >= 2) this.sh.getRange(2, 1, n - 1, this.cols.length).clearContent();
  if (keep.length) this.sh.getRange(2, 1, keep.length, this.cols.length).setNumberFormat('@').setValues(keep);
  this._rows = null;
  return gone;
};
Table.prototype.tail = function (limit) {
  var n = this.sh.getLastRow(); if (n < 2) return [];
  var from = Math.max(2, n - limit + 1), vals = this.sh.getRange(from, 1, n - from + 1, this.cols.length).getValues(), out = [];
  for (var i = vals.length - 1; i >= 0; i--) out.push(this._decode(vals[i]));
  return out;
};
function T(name) { return _tables[name] || (_tables[name] = new Table(name)); }

/* ---------------- settings (key/value) ---------------- */
function getSetting(key, dflt) { var r = T('Settings').by('key', key); return r ? r.value : dflt; }
function setSetting(key, value) {
  var t = T('Settings'), r = t.by('key', key);
  if (r) t.update(r, { value: String(value) }); else t.insert({ key: key, value: String(value) });
}
function orgOut() { return { id: 'org', name: getSetting('org_name', 'Farm Visit'), currency: getSetting('currency', '₹'), language: getSetting('language', 'en'), selfSignup: getSetting('self_signup', 'on') !== 'off' }; }
function configOut() {
  var c = parseJson(getSetting('config', '')) || FV.emptyConfig();
  c.version = Number(getSetting('config_version', '1')) || 1;
  return c;
}

/* ---------------- audit log ---------------- */
function log(u, action, detail) { T('Audit').insert({ at: nowIso(), user: u ? u.name : '', action: action, detail: str(detail, 400) }); }

/* ---------------- users and sessions ---------------- */
function userOut(u) { return { id: u.id, name: u.name, email: u.email, role: u.role, orgLabel: u.org_label, active: u.active, mustChange: u.must_change, lastLogin: u.last_login || null, access: u.access || '*' }; }
function isAdmin(u) { return u.role === 'owner' || u.role === 'admin'; }
function needAdmin(u) { if (!isAdmin(u)) throw new HttpError(403, 'Only an admin can do this'); }

function rateKey(k) { return 'rl_' + sha256(k).slice(0, 24); }
function rateTake(key, max, seconds) {
  var c = CacheService.getScriptCache(), k = rateKey(key), n = Number(c.get(k) || 0);
  if (n >= max) return false;
  c.put(k, String(n + 1), seconds);
  return true;
}
function rateReset(key) { CacheService.getScriptCache().remove(rateKey(key)); }

function startSession(userId) {
  var token = newToken(), exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  T('Sessions').insert({ token_hash: sha256(token), user_id: userId, created_at: nowIso(), expires_at: exp });
  return token;
}
function sessionUser(token) {
  if (!token || typeof token !== 'string' || token.length < 40) return null;
  var s = T('Sessions').by('token_hash', sha256(token)); if (!s) return null;
  if (s.expires_at < nowIso()) { T('Sessions').removeWhere(function (r) { return r.expires_at < nowIso(); }); return null; }
  var u = T('Users').by('id', s.user_id);
  if (!u || !u.active) return null;
  u._token = token; u._tokenHash = s.token_hash;
  return u;
}

/* ---------------- farms and visibility ---------------- */
function farmOut(f) { return { id: f.id, farmer: f.farmer, farm: f.farm, location: f.location, phone: f.phone, type: f.type, notes: f.notes, active: f.active }; }
function accessSet(u) { if (u.role !== 'viewer') return null; var a = String(u.access || '*').trim(); if (a === '*' || a === '') return null; var o = {}; a.split(',').forEach(function (x) { if (x) o[x.trim()] = 1; }); return o; }
function canSeeVisit(u, v) {
  if (isAdmin(u)) return true;
  if (u.role === 'auditor') return true;  // reports read every visit; saveVisit and DELETE still limit edits to their own
  var acc = accessSet(u); return !acc || !!acc[v.farm_id];
}
function visibleFarms(u, includeArchived) {
  var acc = accessSet(u);
  return T('Farms').all().filter(function (f) { return (f.active || includeArchived) && (!acc || acc[f.id]); })
    .sort(function (a, b) { return a.farm.toLowerCase() < b.farm.toLowerCase() ? -1 : 1; });
}
function cleanFarm(b) {
  var farmer = str(b.farmer, 80), farm = str(b.farm, 80);
  if (!farmer || !farm) throw new HttpError(400, 'Enter the farmer name and the farm name');
  return { farmer: farmer, farm: farm, location: str(b.location, 120), phone: str(b.phone, 30), type: FTYPES.indexOf(b.type) >= 0 ? b.type : 'Layer', notes: str(b.notes, 400) };
}
function findFarm(farm, farmer, activeOnly) {
  var a = farm.toLowerCase(), b = farmer.toLowerCase(), best = null;
  T('Farms').all().forEach(function (f) { if (f.farm.toLowerCase() === a && f.farmer.toLowerCase() === b && (!activeOnly || f.active) && (!best || (f.active && !best.active))) best = f; });
  return best;
}
function insertFarm(f) {
  var t = nowIso();
  return T('Farms').insert({ id: newId(), farm: f.farm, farmer: f.farmer, location: f.location, phone: f.phone, type: f.type, notes: f.notes, active: true, created_at: t, updated_at: t });
}

/* ---------------- visits ---------------- */
function readData(v) {
  if (v.data !== '@blob') return parseJson(v.data) || {};
  var parts = T('Blobs').all().filter(function (b) { return b.id === v.id; }).sort(function (a, b) { return a.seq - b.seq; });
  return parseJson(parts.map(function (p) { return p.chunk; }).join('')) || {};
}
function visitOut(v, withData) {
  var d = withData === false ? {} : readData(v);
  return { id: v.id, farmId: v.farm_id, userId: v.user_id, no: v.visit_no, date: v.date, type: v.type, score: v.score, rating: v.rating, updatedAt: v.updated_at, data: d };
}
function visitList(u, since) {
  var rows = T('Visits').all().filter(function (v) { return canSeeVisit(u, v) && (!since || v.updated_at > since); });
  rows.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.created_at < b.created_at ? 1 : -1); });
  var needBlobs = rows.some(function (v) { return v.data === '@blob'; });
  if (needBlobs) T('Blobs').all();
  return rows.slice(0, 5000).map(function (v) { return visitOut(v); });
}
var SIG = /^data:image\/png;base64,[A-Za-z0-9+\/=]{20,40000}$/;

/* An admin saving a new report for a named auditor (used by the demo loader and imports) credits that auditor. */
function attributeTo(u, auditorName) {
  if (!isAdmin(u) || !auditorName) return u.id;
  var n = String(auditorName).trim().toLowerCase(), hit = T('Users').find(function (x) { return x.active && x.role === 'auditor' && x.name.toLowerCase() === n; });
  return hit ? hit.id : u.id;
}
function saveVisit(u, id, body) {
  if (u.role === 'viewer') throw new HttpError(403, 'Your account can view reports but not create them');
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) throw new HttpError(400, 'Bad report id');
  var data = body.data; if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Missing report data');
  if (!isDate(data.date)) throw new HttpError(400, 'The visit date is not valid');
  var vt = T('Visits'), cur = vt.by('id', id);
  if (cur && u.role === 'auditor' && cur.user_id !== u.id) throw new HttpError(403, 'This report belongs to another auditor');
  var sum = body.summary && typeof body.summary === 'object' ? body.summary : {};
  var score = sum.score == null ? null : toNum(sum.score);
  var kpis = (Array.isArray(sum.kpis) ? sum.kpis : []).slice(0, 200).map(function (k) {
    return [str(k && k.label, 80), str(k && k.grp, 60), k && k.raw != null && toNum(k.raw) != null ? toNum(k.raw) : null, str(k && k.val, 40), ['ok', 'warn', 'bad', 'na'].indexOf(k && k.st) >= 0 ? k.st : 'na'];
  }).filter(function (k) { return k[0]; });
  var sigA = SIG.test(data.sigA || '') ? data.sigA : '', sigF = SIG.test(data.sigF || '') ? data.sigF : '';
  var clean = {}; for (var k in data) if (k !== 'sigA' && k !== 'sigF') clean[k] = data[k];
  var json = JSON.stringify(clean);
  if (json.length > 400000) throw new HttpError(413, 'Report is too large');
  var kjson = JSON.stringify(kpis); if (kjson.length > CELL_MAX) { kjson = JSON.stringify(kpis.slice(0, 120)); }
  var type = FTYPES.indexOf(data.type) >= 0 ? data.type : '';
  var farm = null;
  if (typeof data.farmId === 'string' && data.farmId) farm = T('Farms').by('id', data.farmId);
  if (!farm && str(data.farm, 80) && str(data.farmer, 80)) {
    farm = findFarm(str(data.farm, 80), str(data.farmer, 80), false);
    if (!farm) farm = insertFarm({ farmer: str(data.farmer, 80), farm: str(data.farm, 80), location: str(data.location, 120), phone: str(data.phone, 30), type: type || 'Layer', notes: '' });
  }
  clean.farmId = farm ? farm.id : '';
  json = JSON.stringify(clean);
  var t = nowIso(), inBlob = json.length > CELL_MAX;
  var rec = {
    id: id, visit_no: str(clean.no, 40), date: clean.date, farm_id: clean.farmId, farm: str(clean.farm, 80), farmer: str(clean.farmer, 80), type: type,
    auditor: str(clean.auditor, 80), user_id: cur ? cur.user_id : attributeTo(u, clean.auditor), score: score, rating: str(sum.rating, 30), kpis: kjson,
    data: inBlob ? '@blob' : json, updated_at: t
  };
  if (cur) { rec._row = cur._row; rec.created_at = cur.created_at; vt.save(rec); } else { rec.created_at = t; vt.insert(rec); }
  var bt = T('Blobs');
  if (cur && cur.data === '@blob' || inBlob) bt.removeWhere(function (b) { return b.id === id; });
  if (inBlob) for (var i = 0, s = 0; i < json.length; i += CELL_MAX, s++) bt.insert({ id: id, seq: s, chunk: json.slice(i, i + CELL_MAX) });
  var st = T('Signatures');
  var oldSig = st.by('visit_id', id);
  if (sigA || sigF) { if (oldSig) st.update(oldSig, { sig_auditor: sigA, sig_farmer: sigF }); else st.insert({ visit_id: id, sig_auditor: sigA, sig_farmer: sigF }); }
  else if (oldSig) st.removeWhere(function (r) { return r.visit_id === id; });
  log(u, cur ? 'visit-update' : 'visit-save', str(clean.no, 40) + ' ' + str(clean.farm, 60));
  return { id: id, farmId: clean.farmId, updatedAt: t };
}

/* ---------------- routes ---------------- */
var ROUTES = [];
function route(method, pattern, opts, fn) {
  if (typeof opts === 'function') { fn = opts; opts = {}; }
  var keys = [], re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, function (_, k) { keys.push(k); return '([^/]+)'; }) + '$');
  ROUTES.push({ method: method, re: re, keys: keys, open: !!opts.open, write: opts.write !== false && method !== 'GET', fn: fn });
}

route('GET', '/api/auth/status', { open: true }, function () {
  var n = T('Users').all().length;
  return { configured: n > 0, orgName: n > 0 ? getSetting('org_name', '') : '', selfSignup: n > 0 && getSetting('self_signup', 'on') !== 'off' };
});
route('POST', '/api/auth/setup', { open: true }, function (c) {
  if (T('Users').all().length) throw new HttpError(403, 'This workspace is already set up. Sign in instead.');
  var b = c.body, orgName = str(b.orgName, 80), name = str(b.name, 80), email = str(b.email, 200).toLowerCase();
  if (!orgName || !name) throw new HttpError(400, 'Enter your organisation and your name');
  if (!validLogin(email)) throw new HttpError(400, 'Enter a username (3 or more letters or numbers, . _ - allowed) or an email address');
  if (!validPassword(b.password)) throw new HttpError(400, 'Use a password of at least 8 characters');
  var salt = newId(), t = nowIso();
  setSetting('org_name', orgName); setSetting('currency', str(b.currency, 8) || '₹'); setSetting('language', 'en');
  setSetting('config', JSON.stringify(FV.emptyConfig())); setSetting('config_version', '1'); setSetting('created_at', t);
  var u = T('Users').insert({ id: newId(), email: email, name: name, role: 'owner', org_label: orgName, access: '*', pw_salt: salt, pw_hash: hashPw(b.password, salt), must_change: false, active: true, created_at: t, last_login: t });
  log(u, 'setup', orgName);
  return { ok: true, token: startSession(u.id), mustChange: false };
});
route('POST', '/api/auth/login', { open: true }, function (c) {
  var email = str(c.body.email, 200).toLowerCase();
  if (!rateTake('login|' + email, 8, 900)) throw new HttpError(429, 'Too many attempts. Wait a few minutes and try again.');
  var u = T('Users').by('email', email);
  if (!u || !u.active || !safeEq(hashPw(String(c.body.password || ''), u.pw_salt), u.pw_hash)) throw new HttpError(401, 'Wrong username or password');
  rateReset('login|' + email);
  T('Users').update(u, { last_login: nowIso() });
  T('Sessions').removeWhere(function (r) { return r.expires_at < nowIso(); });
  log(u, 'login', '');
  return { ok: true, token: startSession(u.id), mustChange: u.must_change };
});
/* Auditors can create their own account with a username and password, unless an admin turned this off. */
route('POST', '/api/auth/signup', { open: true }, function (c) {
  if (!T('Users').all().length) throw new HttpError(403, 'This workspace is not set up yet');
  if (getSetting('self_signup', 'on') === 'off') throw new HttpError(403, 'Sign-up is turned off. Ask your admin to add you.');
  var b = c.body, login = str(b.username, 40).toLowerCase();
  if (!validUsername(login)) throw new HttpError(400, 'Choose a username of 3 or more letters or numbers (. _ - allowed)');
  if (!validPassword(b.password)) throw new HttpError(400, 'Use a password of at least 8 characters');
  if (!rateTake('signup', 30, 3600)) throw new HttpError(429, 'Too many new accounts just now. Try again later.');
  if (T('Users').by('email', login)) throw new HttpError(409, 'That username is taken. Choose another.');
  var salt = newId(), t = nowIso();
  var u = T('Users').insert({ id: newId(), email: login, name: login, role: 'auditor', org_label: getSetting('org_name', ''), access: '*', pw_salt: salt, pw_hash: hashPw(b.password, salt), must_change: false, active: true, created_at: t, last_login: t });
  log(u, 'signup', login);
  return { ok: true, token: startSession(u.id), mustChange: false };
});
route('POST', '/api/auth/logout', function (c) { T('Sessions').removeWhere(function (r) { return r.token_hash === c.user._tokenHash; }); return { ok: true }; });
route('POST', '/api/auth/password', function (c) {
  var u = c.user, b = c.body;
  if (!rateTake('pw|' + u.id, 8, 900)) throw new HttpError(429, 'Too many attempts. Wait a few minutes and try again.');
  if (!safeEq(hashPw(String(b.current || ''), u.pw_salt), u.pw_hash)) throw new HttpError(400, 'Your current password is not right');
  if (!validPassword(b.next)) throw new HttpError(400, 'Use a new password of at least 8 characters');
  var salt = newId();
  T('Users').update(u, { pw_salt: salt, pw_hash: hashPw(b.next, salt), must_change: false });
  T('Sessions').removeWhere(function (r) { return r.user_id === u.id && r.token_hash !== u._tokenHash; });
  log(u, 'password-change', '');
  return { ok: true };
});
route('GET', '/api/me', function (c) { return { user: userOut(c.user), org: orgOut() }; });

route('GET', '/api/bootstrap', function (c) {
  var u = c.user, auditors = u.role === 'auditor' || u.role === 'viewer'
    ? [{ id: u.id, name: u.name, orgLabel: u.org_label }]
    : T('Users').all().filter(function (x) { return x.active && x.role !== 'viewer'; }).map(function (x) { return { id: x.id, name: x.name, orgLabel: x.org_label }; }).sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
  return { user: userOut(u), org: orgOut(), config: configOut(), farms: visibleFarms(u).map(farmOut), auditors: auditors, visits: visitList(u, null), serverTime: nowIso() };
});
route('GET', '/api/config', function () { return configOut(); });
route('PUT', '/api/config', function (c) {
  needAdmin(c.user);
  var cur = configOut();
  if (Number(c.body.version) !== cur.version) throw new HttpError(409, 'Someone else changed the settings. Reload and try again.', { config: cur });
  var r = FV.validateConfig(c.body.config);
  if (!r.ok) throw new HttpError(400, r.errors[0], { errors: r.errors });
  var json = JSON.stringify(r.config);
  if (json.length > CELL_MAX) throw new HttpError(413, 'Settings are too large. Remove some custom fields or metrics.');
  setSetting('config', json); setSetting('config_version', String(cur.version + 1));
  log(c.user, 'config', r.config.fields.length + ' fields, ' + r.config.kpis.length + ' custom metrics');
  return configOut();
});
route('PUT', '/api/org', function (c) {
  needAdmin(c.user);
  var name = str(c.body.name, 80), cur = str(c.body.currency, 8), lang = ['en', 'hi', 'dv'].indexOf(c.body.language) >= 0 ? c.body.language : null;
  if (!name) throw new HttpError(400, 'Enter an organisation name');
  setSetting('org_name', name); setSetting('currency', cur || '₹'); if (lang) setSetting('language', lang);
  if (c.body.selfSignup !== undefined) setSetting('self_signup', c.body.selfSignup ? 'on' : 'off');
  log(c.user, 'org', name);
  return orgOut();
});

/* farms */
route('GET', '/api/farms', function (c) { return visibleFarms(c.user, c.query.all === '1' && isAdmin(c.user)).map(farmOut); });
route('POST', '/api/farms', function (c) {
  if (c.user.role === 'viewer') throw new HttpError(403, 'Your account can view reports but not add farms');
  var f = cleanFarm(c.body), dup = findFarm(f.farm, f.farmer, true);
  if (dup) return farmOut(dup);
  var rec = insertFarm(f); log(c.user, 'farm-add', f.farm); return farmOut(rec);
});
route('POST', '/api/farms/bulk', function (c) {
  needAdmin(c.user);
  var list = Array.isArray(c.body.farms) ? c.body.farms.slice(0, 500) : [], added = 0, skipped = 0;
  list.forEach(function (b) {
    var f; try { f = cleanFarm(b); } catch (e) { skipped++; return; }
    if (findFarm(f.farm, f.farmer, true)) { skipped++; return; }
    insertFarm(f); added++;
  });
  log(c.user, 'farm-import', added + ' added');
  return { added: added, skipped: skipped };
});
route('PUT', '/api/farms/:id', function (c) {
  needAdmin(c.user);
  var cur = T('Farms').by('id', c.params.id); if (!cur) throw new HttpError(404, 'Farm not found');
  var merged = {}; for (var k in cur) merged[k] = cur[k]; for (var k2 in c.body) merged[k2] = c.body[k2];
  var f = cleanFarm(merged);
  T('Farms').update(cur, { farmer: f.farmer, farm: f.farm, location: f.location, phone: f.phone, type: f.type, notes: f.notes, active: c.body.active === false ? false : true, updated_at: nowIso() });
  log(c.user, 'farm-edit', f.farm);
  return farmOut(cur);
});
route('DELETE', '/api/farms/:id', function (c) {
  needAdmin(c.user);
  var cur = T('Farms').by('id', c.params.id); if (!cur) throw new HttpError(404, 'Farm not found');
  T('Farms').update(cur, { active: false, updated_at: nowIso() }); log(c.user, 'farm-archive', cur.farm);
  return { ok: true };
});

/* users */
route('GET', '/api/users', function (c) {
  needAdmin(c.user);
  return T('Users').all().slice().sort(function (a, b) { return (b.active - a.active) || (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1); }).map(userOut);
});
function cleanAccess(v, fallback) {
  if (v === undefined) return fallback;
  if (v === '*' || v === '' || v == null) return '*';
  var ids = (Array.isArray(v) ? v : String(v).split(',')).map(function (x) { return String(x).trim(); }).filter(Boolean);
  if (ids.indexOf('*') >= 0) return '*';
  var valid = {}; T('Farms').all().forEach(function (f) { valid[f.id] = 1; });
  ids = ids.filter(function (x) { return valid[x]; });
  return ids.length ? ids.join(',') : '-';       // '-' = no farms at all
}
route('POST', '/api/users', function (c) {
  var u = c.user; needAdmin(u);
  var b = c.body, name = str(b.name, 80), email = str(b.email, 200).toLowerCase(), role = ROLES.indexOf(b.role) >= 0 ? b.role : 'auditor';
  if (!name) throw new HttpError(400, 'Enter the person’s name');
  if (!validLogin(email)) throw new HttpError(400, 'Enter a username (3 or more letters or numbers, . _ - allowed) or an email address');
  if (role === 'owner' && u.role !== 'owner') throw new HttpError(403, 'Only an owner can add another owner');
  if (T('Users').by('email', email)) throw new HttpError(409, 'That username or email already has an account');
  var pw = validPassword(b.password) ? b.password : tempPassword(), salt = newId();
  var rec = T('Users').insert({ id: newId(), email: email, name: name, role: role, org_label: str(b.orgLabel, 80), access: cleanAccess(b.access, '*'), pw_salt: salt, pw_hash: hashPw(pw, salt), must_change: b.mustChange === false && u.role === 'owner' ? false : true, active: true, created_at: nowIso(), last_login: '' });
  log(u, 'user-add', email + ' as ' + role);
  return { user: userOut(rec), tempPassword: pw };
});
route('PATCH', '/api/users/:id', function (c) {
  var u = c.user; needAdmin(u);
  var t = T('Users').by('id', c.params.id); if (!t) throw new HttpError(404, 'User not found');
  var b = c.body;
  if (t.role === 'owner' && u.role !== 'owner') throw new HttpError(403, 'Only an owner can change an owner');
  var role = b.role !== undefined ? b.role : t.role;
  if (ROLES.indexOf(role) < 0) throw new HttpError(400, 'Unknown role');
  if (role === 'owner' && u.role !== 'owner') throw new HttpError(403, 'Only an owner can make someone an owner');
  var active = b.active !== undefined ? !!b.active : t.active;
  var owners = T('Users').all().filter(function (x) { return x.role === 'owner' && x.active; }).length;
  if (t.role === 'owner' && (role !== 'owner' || !active) && owners <= 1) throw new HttpError(400, 'An organisation needs at least one active owner');
  if (t.id === u.id && !active) throw new HttpError(400, 'You cannot deactivate yourself');
  var name = b.name !== undefined ? str(b.name, 80) : t.name; if (!name) throw new HttpError(400, 'Enter the person’s name');
  var label = b.orgLabel !== undefined ? str(b.orgLabel, 80) : t.org_label;
  var patch = { name: name, role: role, active: active, org_label: label, access: cleanAccess(b.access, t.access || '*') };
  var temp = null;
  if (b.resetPassword) { temp = tempPassword(); var salt = newId(); patch.pw_salt = salt; patch.pw_hash = hashPw(temp, salt); patch.must_change = true; }
  T('Users').update(t, patch);
  if (!active || b.resetPassword) T('Sessions').removeWhere(function (r) { return r.user_id === t.id; });
  log(u, 'user-edit', t.email + (b.resetPassword ? ' (password reset)' : ''));
  return { user: userOut(t), tempPassword: temp };
});

/* visits */
route('GET', '/api/visits', function (c) { return visitList(c.user, c.query.since || null); });
route('GET', '/api/visits/:id', function (c) {
  var v = T('Visits').by('id', c.params.id);
  if (!v || !canSeeVisit(c.user, v)) throw new HttpError(404, 'Report not found');
  var out = visitOut(v), s = T('Signatures').by('visit_id', v.id);
  if (s) { out.data.sigA = s.sig_auditor; out.data.sigF = s.sig_farmer; }
  return out;
});
route('PUT', '/api/visits/:id', function (c) { return saveVisit(c.user, c.params.id, c.body); });
route('DELETE', '/api/visits/:id', function (c) {
  var v = T('Visits').by('id', c.params.id);
  if (!v || !canSeeVisit(c.user, v) || (!isAdmin(c.user) && v.user_id !== c.user.id)) throw new HttpError(404, 'Report not found');
  T('Visits').removeWhere(function (r) { return r.id === v.id; });
  T('Signatures').removeWhere(function (r) { return r.visit_id === v.id; });
  if (v.data === '@blob') T('Blobs').removeWhere(function (r) { return r.id === v.id; });
  log(c.user, 'visit-delete', v.visit_no);
  return { ok: true };
});

/* admin: everything in one place */
function isoDaysAgo(n) { return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }
function weekStart(d) { var t = new Date(d + 'T00:00:00Z'), day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day); return t.toISOString().slice(0, 10); }
function avg(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
route('GET', '/api/admin/overview', function (c) {
  needAdmin(c.user);
  var since90 = isoDaysAgo(90), since30 = isoDaysAgo(30), since84 = isoDaysAgo(84);
  var visits = T('Visits').all().slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.created_at < b.created_at ? 1 : -1); });
  var farms = T('Farms').all().filter(function (f) { return f.active; });
  var scored90 = visits.filter(function (v) { return v.date >= since90 && v.score != null; }).map(function (v) { return v.score; });
  var totals = { farms: farms.length, users: T('Users').all().filter(function (u) { return u.active; }).length, visits: visits.length,
    visits30: visits.filter(function (v) { return v.date >= since30; }).length, avgScore90: avg(scored90) };
  var farmRows = farms.map(function (f) {
    var vs = visits.filter(function (v) { return v.farm_id === f.id; }), last = vs[0] || null, a = vs.filter(function (v) { return v.date >= since90 && v.score != null; }).map(function (v) { return v.score; });
    return { id: f.id, farm: f.farm, farmer: f.farmer, location: f.location, type: f.type, visits: vs.length, lastDate: last ? last.date : null, lastScore: last ? last.score : null, lastRating: last ? last.rating : null, avg90: avg(a) };
  }).sort(function (a, b) {
    var an = a.lastScore == null ? 1 : 0, bn = b.lastScore == null ? 1 : 0;
    return an - bn || ((a.lastScore || 0) - (b.lastScore || 0)) || (a.farm.toLowerCase() < b.farm.toLowerCase() ? -1 : 1);
  });
  var wk = {};
  visits.forEach(function (v) { if (v.date >= since84 && v.score != null) { var k = weekStart(v.date); (wk[k] = wk[k] || []).push(v.score); } });
  var trend = Object.keys(wk).sort().map(function (k) { return { wk: k, start: k, avg: avg(wk[k]), n: wk[k].length }; });
  var km = {};
  visits.forEach(function (v) {
    if (v.date < since90) return;
    (parseJson(v.kpis) || []).forEach(function (k) {
      var m = km[k[0]] = km[k[0]] || { label: k[0], grp: k[1], raws: [], ok: 0, warn: 0, bad: 0 };
      if (k[2] != null) m.raws.push(k[2]);
      if (k[4] === 'ok' || k[4] === 'warn' || k[4] === 'bad') m[k[4]]++;
    });
  });
  var kp = Object.keys(km).map(function (l) {
    var m = km[l]; if (!m.raws.length) return null;
    return { label: m.label, grp: m.grp, n: m.raws.length, avg: avg(m.raws), min: Math.min.apply(null, m.raws), max: Math.max.apply(null, m.raws), ok: m.ok, warn: m.warn, bad: m.bad };
  }).filter(Boolean).sort(function (a, b) { return a.grp < b.grp ? -1 : a.grp > b.grp ? 1 : (a.label < b.label ? -1 : 1); });
  var fm = {}; farms.forEach(function (f) { fm[f.id] = f; });
  var recent = visits.slice(0, 15).map(function (v) { var f = fm[v.farm_id]; return { id: v.id, no: v.visit_no, date: v.date, score: v.score, rating: v.rating, auditor: v.auditor, type: v.type, farm: f ? f.farm : v.farm, farmer: f ? f.farmer : v.farmer }; });
  var ba = {};
  visits.forEach(function (v) { if (v.date >= since90) { var m = ba[v.auditor] = ba[v.auditor] || { name: v.auditor, visits: 0, s: [] }; m.visits++; if (v.score != null) m.s.push(v.score); } });
  var byAuditor = Object.keys(ba).map(function (k) { return { name: ba[k].name, visits: ba[k].visits, avg: avg(ba[k].s) }; }).sort(function (a, b) { return b.visits - a.visits; });
  return { totals: totals, farms: farmRows, trend: trend, kpis: kp, recent: recent, byAuditor: byAuditor, since90: since90 };
});
route('GET', '/api/admin/audit', function (c) {
  needAdmin(c.user);
  return T('Audit').tail(200).map(function (r, i) { return { id: i, userName: r.user, action: r.action, detail: r.detail, at: r.at }; });
});
route('GET', '/api/admin/sheet', function (c) { needAdmin(c.user); return { url: ss().getUrl(), name: ss().getName() }; });

function csvCell(v) { if (v == null) return ''; var s = String(v); if (/^[=+\-@\t\r]/.test(s) && isNaN(Number(s))) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function csv(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n'; }
function fileRes(name, type, text) { return { __file: { name: name, type: type, text: text } }; }
route('GET', '/api/admin/export/visits.csv', function (c) {
  needAdmin(c.user);
  var cfg = configOut(), visits = T('Visits').all().slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created_at < b.created_at ? -1 : 1); });
  T('Blobs').all();
  var fm = {}; T('Farms').all().forEach(function (f) { fm[f.id] = f; });
  var labels = {}; visits.forEach(function (v) { (parseJson(v.kpis) || []).forEach(function (k) { if (!labels[k[0]]) labels[k[0]] = k[1]; }); });
  var names = Object.keys(labels).sort(function (a, b) { return labels[a] < labels[b] ? -1 : labels[a] > labels[b] ? 1 : (a < b ? -1 : 1); });
  var inputs = FV.FIELDS.map(function (f) { return { k: f.k, l: f.l }; }).concat(cfg.fields.map(function (f) { return { k: f.id, l: f.label }; }));
  var head = ['Visit no', 'Date', 'Farm', 'Farmer', 'Location', 'Type', 'Auditor', 'Score', 'Rating'].concat(names.map(function (l) { return 'KPI: ' + l; }), inputs.map(function (i) { return 'Input: ' + i.l; }));
  var rows = [head].concat(visits.map(function (v) {
    var d = readData(v), f = fm[v.farm_id], km = {}; (parseJson(v.kpis) || []).forEach(function (k) { km[k[0]] = k[2]; });
    return [v.visit_no, v.date, f ? f.farm : d.farm, f ? f.farmer : d.farmer, f ? f.location : d.location, v.type, v.auditor, v.score == null ? '' : +v.score.toFixed(1), v.rating]
      .concat(names.map(function (l) { return km[l] != null ? +(+km[l]).toFixed(4) : ''; }), inputs.map(function (i) { return d[i.k] == null ? '' : d[i.k]; }));
  }));
  log(c.user, 'export', 'visits.csv'); return fileRes('visits.csv', 'text/csv; charset=utf-8', '﻿' + csv(rows));
});
function kpiRows() {
  var fm = {}; T('Farms').all().forEach(function (f) { fm[f.id] = f; });
  var rows = [];
  T('Visits').all().slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.visit_no < b.visit_no ? -1 : 1); }).forEach(function (v) {
    (parseJson(v.kpis) || []).forEach(function (k) { rows.push([v.visit_no, v.date, fm[v.farm_id] ? fm[v.farm_id].farm : v.farm, v.type, k[1], k[0], k[2] == null ? '' : k[2], k[3], k[4]]); });
  });
  return rows;
}
route('GET', '/api/admin/export/kpis.csv', function (c) {
  needAdmin(c.user);
  var rows = [['Visit no', 'Date', 'Farm', 'Type', 'Group', 'Metric', 'Value', 'Shown as', 'Status']].concat(kpiRows());
  log(c.user, 'export', 'kpis.csv'); return fileRes('kpis-long.csv', 'text/csv; charset=utf-8', '﻿' + csv(rows));
});
route('GET', '/api/admin/export/backup.json', function (c) {
  needAdmin(c.user);
  T('Blobs').all();
  var out = { exportedAt: nowIso(), org: orgOut(), config: configOut(), farms: T('Farms').all().map(farmOut), visits: T('Visits').all().map(function (v) { return visitOut(v); }) };
  log(c.user, 'export', 'backup.json'); return fileRes('farm-backup-' + nowIso().slice(0, 10) + '.json', 'application/json', JSON.stringify(out, null, 1));
});
/* Writes every metric of every visit to a tab called "KPI readings" so it can be pivoted in Sheets. */
route('POST', '/api/admin/rebuild-kpi-sheet', function (c) {
  needAdmin(c.user);
  var name = 'KPI readings', sh = ss().getSheetByName(name) || ss().insertSheet(name);
  sh.clear();
  var rows = [['Visit no', 'Date', 'Farm', 'Type', 'Group', 'Metric', 'Value', 'Shown as', 'Status']].concat(kpiRows());
  sh.getRange(1, 1, rows.length, 9).setValues(rows);
  sh.setFrozenRows(1); sh.getRange(1, 1, 1, 9).setFontWeight('bold');
  log(c.user, 'kpi-sheet', (rows.length - 1) + ' rows');
  return { rows: rows.length - 1 };
});

/* ---------------- web app entry points ---------------- */
function reply(status, body) {
  return ContentService.createTextOutput(JSON.stringify({ s: status, d: body })).setMimeType(ContentService.MimeType.JSON);
}
function dispatch(method, path, token, body, query) {
  var m = null, params = {};
  for (var i = 0; i < ROUTES.length; i++) {
    var r = ROUTES[i]; if (r.method !== method) continue;
    var x = r.re.exec(path); if (!x) continue;
    m = r; r.keys.forEach(function (k, j) { params[k] = decodeURIComponent(x[j + 1]); }); break;
  }
  if (!m) throw new HttpError(404, 'Unknown API route');
  var lock = null;
  if (m.write) { lock = LockService.getScriptLock(); if (!lock.tryLock(25000)) throw new HttpError(503, 'The sheet is busy. Try again in a few seconds.'); }
  try {
    var user = null;
    if (!m.open) {
      user = sessionUser(token); if (!user) throw new HttpError(401, 'Please log in');
      if (user.must_change && ['/api/auth/password', '/api/auth/logout', '/api/me'].indexOf(path) < 0) throw new HttpError(403, 'Set a new password first', { mustChange: true });
    }
    return m.fn({ user: user, body: body || {}, params: params, query: query || {} });
  } finally { if (lock) lock.releaseLock(); }
}
function handle(method, path, token, body, query) {
  _ss = null; _tables = {};
  try {
    var out = dispatch(method, path, token, body, query);
    return reply(200, out === undefined ? { ok: true } : out);
  } catch (e) {
    if (e instanceof HttpError) return reply(e.status, Object.assign({ error: e.message }, e.extra || {}));
    console.error(e && e.stack || e);
    return reply(500, { error: 'Something went wrong in the sheet backend: ' + (e && e.message ? e.message : e) });
  }
}
function doGet(e) {
  var q = (e && e.parameter) || {};
  if (q.p) return handle('GET', q.p, q.t || '', {}, q);
  _ss = null; _tables = {};
  return reply(200, { ok: true, service: 'farm-visit-sheet-backend', configured: T('Users').all().length > 0 });
}
function doPost(e) {
  var raw = e && e.postData && e.postData.contents, req = parseJson(raw || '');
  if (!req || typeof req.p !== 'string' || typeof req.m !== 'string') return reply(400, { error: 'Send JSON' });
  var q = {}, qi = req.p.indexOf('?'), path = req.p;
  if (qi >= 0) { path = req.p.slice(0, qi); req.p.slice(qi + 1).split('&').forEach(function (kv) { var a = kv.split('='); if (a[0]) q[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); }); }
  return handle(req.m.toUpperCase(), path, req.t || '', req.b && typeof req.b === 'object' ? req.b : {}, q);
}
/* Run once from the editor to create the tabs and authorise the script. */
function setup() { _ss = null; _tables = {}; Object.keys(SCHEMA).forEach(function (n) { T(n); }); Logger.log('Tabs ready: ' + Object.keys(SCHEMA).join(', ')); }
