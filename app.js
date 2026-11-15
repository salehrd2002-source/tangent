/* Tangent — a calculus tutor that checks handwritten work line by line.
 * The AI reads handwriting and writes hints. engine.js decides what is correct. */
(function () {
  'use strict';

  // ------------------------------------------------------------------ data
  const KEY = 'tangent.v1';
  const DAY = 86400000;
  const CATS = {
    sign: { name: 'Sign error', advice: 'Slow down wherever a minus meets a bracket. Write the bracket out before you expand it.' },
    algebra: { name: 'Algebra slip', advice: 'The calculus is fine; the simplifying is not. Do one algebraic move per line for a while.' },
    chain: { name: 'Chain rule missed', advice: 'Before differentiating, name the inner function out loud. If there is one, its derivative must appear as a factor.' },
    product_quotient: { name: 'Product or quotient rule', advice: 'Write u, v, u′, v′ as side work first, then assemble. Do not assemble from memory.' },
    basic_derivative: { name: 'Wrong basic derivative', advice: 'One standard derivative is not solid yet. Derive it once from the definition, then drill it.' },
    indeterminate: { name: 'Indeterminate form mishandled', advice: 'Substitute first and name the form (0/0, ∞/∞, ∞−∞…) before choosing a technique.' },
    lhopital: { name: 'L’Hôpital misused', advice: 'Check the form is 0/0 or ∞/∞ every single time, and differentiate top and bottom separately.' },
    limit_law: { name: 'Limit law misapplied', advice: 'A limit law only applies when each separate limit exists. Check that before splitting.' },
    identity: { name: 'Trig, exponential or log identity', advice: 'Keep a short list of the identities you actually use and test each one with a number when unsure.' },
    copying: { name: 'Copying error', advice: 'A term changed between lines without a reason. Tick each term off as you carry it down.' },
    concept: { name: 'Conceptual misunderstanding', advice: 'This is about what the idea means, not the mechanics. Open Concepts and work through it.' },
    other: { name: 'Other', advice: '' },
  };

  const blank = () => ({ settings: { key: '', model: 'deepseek-flash' }, exercises: [], concepts: [] });
  let store = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) store = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { /* start fresh */ }
  let storageOk = true;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); storageOk = true; }
    catch (e) { storageOk = false; }
  }

  // ------------------------------------------------------------------ dom helpers
  const main = document.getElementById('main');
  const tabsEl = document.getElementById('tabs');
  const sheetRoot = document.getElementById('sheet-root');

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  }

  function mathEl(latex, block) {
    const el = h('div', { class: 'mathline' });
    try { katex.render('\\displaystyle ' + (latex || ''), el, { throwOnError: false, displayMode: false, strict: false }); }
    catch (e) { el.textContent = latex || ''; }
    return el;
  }

  // Text with $inline maths$ in it.
  function rich(text) {
    const el = h('span', {});
    String(text || '').split(/\$\$?([^$]+)\$\$?/).forEach((part, i) => {
      if (i % 2 === 0) { el.append(part); return; }
      const s = h('span', {});
      try { katex.render(part, s, { throwOnError: false, strict: false }); } catch (e) { s.textContent = part; }
      el.append(s);
    });
    return el;
  }

  function stepTex(step, variable) {
    if (step.expr) { try { return Engine.tex(step.expr, variable); } catch (e) { /* fall through */ } }
    if (step.latex) return step.latex;
    return '\\text{' + String(step.expr || '(empty line)').replace(/[\\{}$%#&_^~]/g, ' ') + '}';
  }
  const problemTex = (p) => (p.expr || p.latex) ? stepTex(p, p.variable) : null;
  function problemEl(p) { const t = problemTex(p); return t ? mathEl(t) : h('div', {}, p.text || 'Untitled problem'); }

  const fmtDate = (t) => {
    const d = Math.floor((Date.now() - t) / DAY);
    if (d <= 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return d + ' days ago';
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  // ------------------------------------------------------------------ AI
  class Friendly extends Error {}

  async function ai({ system, user, images, effort }) {
    const key = store.settings.key;
    if (!key) throw new Friendly('Add your DeepSeek API key in Settings first.');
    const content = images && images.length
      ? [{ type: 'text', text: user }].concat(images.map((url) => ({ type: 'image_url', image_url: { url } })))
      : user;
    const base = {
      model: store.settings.model || 'deepseek-flash',
      messages: [{ role: 'system', content: system }, { role: 'user', content }],
    };
    const full = Object.assign({}, base, {
      response_format: { type: 'json_object' }, thinking: { type: 'enabled' }, reasoning_effort: effort || 'low', max_tokens: 16000,
    });
    const call = async (body) => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 150000);
      try {
        return await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST', signal: ctl.signal,
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify(body),
        });
      } catch (e) {
        throw new Friendly(e.name === 'AbortError' ? 'The AI took too long to answer. Try again.' : 'Could not reach DeepSeek. Check your connection.');
      } finally { clearTimeout(timer); }
    };
    let res = await call(full);
    if (res.status === 400 || res.status === 422) res = await call(base); // retry without optional parameters
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error.message || ''; } catch (e) { /* ignore */ }
      if (res.status === 401) throw new Friendly('DeepSeek rejected the API key. Check it in Settings.');
      if (res.status === 402) throw new Friendly('Your DeepSeek balance is empty. Top it up at platform.deepseek.com.');
      if (res.status === 429) throw new Friendly('DeepSeek is rate-limiting requests. Wait a moment and try again.');
      throw new Friendly('DeepSeek returned an error (' + res.status + '). ' + detail.slice(0, 160));
    }
    const data = await res.json();
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    try { return JSON.parse(text.slice(a, b + 1)); }
    catch (e) { throw new Friendly('The AI answered in a form I could not read. Try again.'); }
  }

  const SYNTAX = `Expression syntax (strict, machine-parsed):
- Plain text maths: + - * / ^ and parentheses. Always put function arguments in parentheses: sin(x)^2, never sin^2 x.
- Functions: sin cos tan sec csc cot asin acos atan sinh cosh tanh sqrt(x) abs(x) exp(x) ln(x) log10(x). Constants: e, pi, Infinity.
- Derivative with respect to the problem variable: D(f). A second derivative is D(D(f)). A prime written by the student, such as (x^2)', is D(x^2).
- Limit as the problem variable goes to a: lim(f, a). One-sided: lim(f, a, 1) from the right, lim(f, a, -1) from the left. Limit in a different variable h: lim(f, h, a).
- No LaTeX, no equals sign unless stated, no words.`;

  const TRANSCRIBE = `You transcribe a student's handwritten calculus work so that a separate program can check it.
Do NOT solve, correct, tidy or judge anything. Copy exactly what is written, including every mistake. If you fix an error the student will never find out about it.

Return one JSON object:
{
  "problem": { "text": string, "expr": string|null, "variable": string },
  "steps": [ { "expr": string|null, "latex": string, "role": "main"|"aside" } ],
  "note": string|null
}

problem.text: the task in plain words, e.g. "Differentiate x^2 sin x".
problem.expr: the quantity to be computed, in the syntax below, e.g. "D(x^2*sin(x))" or "lim(sin(3*x)/x, 0)". Use null when the task is not "compute this expression" (word problems, proofs, implicit differentiation, tangent lines, optimisation).
problem.variable: the single-letter variable, usually "x".

steps: the student's lines in order.
- role "main": a line that restates the whole answer so far, so it should be equal to the problem. expr is only the expression: drop prefixes such as "f'(x) =", "y' =", "dy/dx =" and leading equals signs. If one handwritten line is a chain a = b = c, output a separate step for each of a, b, c.
- role "aside": side work such as "u = x^2+1" or "u' = 2x". Where possible write it as one equation entirely in the problem variable using D(), e.g. "D(x^2+1) = 2*x". Otherwise set expr to null.
- latex: the line as written, in LaTeX, for display.
- Skip lines that are only words. If the student restates the problem as their first line, include it as a main step.

note: mention anything you could not read with confidence, otherwise null.

${SYNTAX}`;

  const DIAGNOSE = `You are a calculus tutor looking at one student's work. A deterministic checker has already evaluated every line numerically. Its verdict is final: do not dispute it, and do not re-derive which line is wrong.

Your job is to work out what the student did between the last correct line and the first wrong line, and to help them find it themselves.

Return one JSON object:
{
  "category": one of ${JSON.stringify(Object.keys(CATS))},
  "hint1": string,   // one question that directs their eyes to the right spot WITHOUT naming the rule or the fix
  "hint2": string,   // names the rule or idea involved and how it works in general. Still no corrected expression.
  "what": string,    // one or two sentences stating plainly what they did wrong. Do not write out the corrected line.
  "fix": { "expr": string },  // the corrected version of the first wrong line ONLY, in the syntax below, keeping the student's own form as far as possible
  "conceptual": boolean,      // true only if the error shows they misunderstand what the idea means, not a slip in execution
  "concept": string|null      // if conceptual: two or three sentences on what the idea actually means
}

Category meanings: sign = lost or flipped sign; algebra = expanding, factoring, fractions, exponents; chain = inner derivative missing or wrong; product_quotient = product/quotient rule structure wrong; basic_derivative = a standard derivative remembered wrongly; indeterminate = treated an indeterminate form as a value or substituted too early; lhopital = L'Hôpital applied when not allowed or applied as quotient rule; limit_law = split or combined limits illegitimately, bad arithmetic with infinity; identity = trig/exp/log identity wrong; copying = a term changed or vanished between lines; concept = misunderstanding of the idea itself; other = none of these.

Write to the student directly, briefly, in a calm and precise tone. No praise, no exclamation marks. Put any maths inside the strings between single dollar signs as LaTeX, e.g. "$\\\\cos(3x^2)$".

${SYNTAX}`;

  const NUDGE = `You are a calculus tutor. The student is partway through a problem and is stuck. A deterministic checker has confirmed that every line shown is correct so far. Help them take the next step themselves.

Return one JSON object:
{
  "hint1": string,  // one question that points at what to notice next, without naming the technique
  "hint2": string,  // names the technique or rule to use next and why it fits, without carrying it out
  "next": { "expr": string }  // the single next line only (not the final answer unless it is one step away), in the syntax below
}

Write briefly and calmly. No praise. Put maths between single dollar signs as LaTeX.

${SYNTAX}`;

  const CONCEPT = `You explain one calculus concept to an engineering student who can do the mechanics but has not yet grasped what the concept means. They are slow to get the meaning and fast once it clicks, so aim for the click: one clear picture, not a survey.

Return one JSON object:
{
  "title": string,
  "meaning": string,     // what it means in plain words, 3-5 sentences, built around one concrete picture (a graph, a moving object, a quantity changing)
  "example": string,     // the idea shown with actual numbers, small enough to follow by eye
  "misreading": string,  // the most common wrong way students understand this, and why it fails
  "question": string,    // one question that can only be answered by understanding the meaning, not by computing with a rule
  "answer": string       // the answer with a one-line reason
}

No formal definitions unless they help. No praise or filler. Put maths between single dollar signs as LaTeX.`;

  // ------------------------------------------------------------------ images
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Friendly('That photo could not be opened.')); };
      img.src = url;
    });
  }

  // ------------------------------------------------------------------ exercise logic
  const lastAttempt = (ex) => ex.attempts[ex.attempts.length - 1];

  function judge(steps, results) {
    if (results.some((r) => r === 'wrong')) return 'wrong';
    let last = -1;
    steps.forEach((s, i) => { if (s.role !== 'aside') last = i; });
    const finished = last >= 0 && results[last] === 'ok' && !/\b(D|lim)\s*\(/.test(steps[last].expr || '');
    return finished ? 'correct' : 'open';
  }

  function runCheck(draft) {
    const res = Engine.check(draft.problem, draft.steps);
    const attempt = {
      at: Date.now(), steps: draft.steps,
      results: res.results.map((r) => r.status), reasons: res.results.map((r) => r.reason),
      firstWrong: res.firstWrong, diagnosis: null, hintsShown: 0, nudge: null,
    };
    let ex = draft.exId && store.exercises.find((e) => e.id === draft.exId);
    if (!ex) {
      ex = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: Date.now(), attempts: [], redoAt: null };
      store.exercises.unshift(ex);
    }
    ex.problem = draft.problem;
    ex.attempts.push(attempt);
    ex.status = judge(attempt.steps, attempt.results);
    if (ex.status === 'wrong') ex.redoAt = Date.now() + 3 * DAY;
    else if (ex.status === 'correct' && ex.redoAt && Date.now() >= ex.redoAt) ex.redoAt = null;
    save();
    go({ name: 'result', exId: ex.id });
    if (ex.status === 'wrong') diagnose(ex, attempt);
  }

  function describe(ex, attempt) {
    const lines = attempt.steps.map((s, i) =>
      (i + 1) + '. [' + (s.role === 'aside' ? 'side work' : 'main') + '] ' + (s.expr || s.latex || '(unreadable)') + '   -> checker: ' + attempt.results[i]);
    return 'Problem: ' + (ex.problem.text || '') + '\nProblem expression: ' + (ex.problem.expr || '(none)') +
      '\nVariable: ' + (ex.problem.variable || 'x') + '\n\nStudent lines:\n' + lines.join('\n');
  }

  async function diagnose(ex, attempt) {
    attempt.diagnosing = true; attempt.diagError = null; refresh();
    try {
      const k = attempt.firstWrong;
      const d = await ai({
        system: DIAGNOSE, effort: 'high',
        user: describe(ex, attempt) + '\n\nThe first wrong line is line ' + (k + 1) + '. ' +
          (k === 0 ? 'It does not follow from the problem itself.' : 'Everything before it is correct.'),
      });
      let verified = false;
      const fixExpr = d.fix && d.fix.expr;
      if (fixExpr) {
        const r = Engine.check(ex.problem, [{ role: attempt.steps[k].role, expr: fixExpr }]);
        verified = r.results[0].status === 'ok';
      }
      attempt.diagnosis = {
        category: CATS[d.category] ? d.category : 'other',
        hint1: d.hint1 || '', hint2: d.hint2 || '', what: d.what || '',
        fix: { expr: fixExpr || '', verified },
        conceptual: !!d.conceptual, concept: d.concept || '',
      };
    } catch (e) {
      attempt.diagError = e instanceof Friendly ? e.message : 'Something went wrong while asking for an explanation.';
    }
    attempt.diagnosing = false; save(); refresh();
  }

  async function nudge(ex, attempt) {
    attempt.nudging = true; attempt.nudgeError = null; refresh();
    try {
      const d = await ai({ system: NUDGE, effort: 'high', user: describe(ex, attempt) + '\n\nThe student is stuck after the last line.' });
      let verified = false;
      const expr = d.next && d.next.expr;
      if (expr) verified = Engine.check(ex.problem, [{ role: 'main', expr }]).results[0].status === 'ok';
      attempt.nudge = { hint1: d.hint1 || '', hint2: d.hint2 || '', next: { expr: expr || '', verified }, shown: 0 };
    } catch (e) {
      attempt.nudgeError = e instanceof Friendly ? e.message : 'Something went wrong while asking for a hint.';
    }
    attempt.nudging = false; save(); refresh();
  }

  // ------------------------------------------------------------------ router
  let view = { name: 'home' };
  const SVG = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const ICONS = {
    home: SVG('<path d="M4 20l1-5L16 4l4 4L9 19l-5 1z"/><path d="M14 6l4 4"/>'),
    patterns: SVG('<path d="M5 20V11M12 20V4M19 20v-6"/>'),
    concepts: SVG('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>'),
    settings: SVG('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
    camera: SVG('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  };
  const icon = (n) => h('span', { innerHTML: ICONS[n], 'aria-hidden': 'true', style: 'display:grid' });
  const ART = '<svg viewBox="0 0 320 96" fill="none" stroke-linecap="round"><path d="M100 82L220 2" stroke="#1d2145" stroke-width="3.5"/><path d="M16 84C90 80 150 60 200 8" stroke="#5b4bff" stroke-width="7"/><circle cx="160.6" cy="41.3" r="9" fill="#fff" stroke="#1d2145" stroke-width="4"/><path d="M262 28v16M254 36h16M290 64v10M285 69h10" stroke="#1d2145" stroke-width="3.5"/><circle cx="44" cy="26" r="7" fill="#ff7a59"/><circle cx="302" cy="22" r="5" fill="#12996a"/></svg>';
  const TABS = [['home', 'Practise'], ['patterns', 'Patterns'], ['concepts', 'Concepts'], ['settings', 'Settings']];
  const FOCUS = new Set(['capture', 'working', 'confirm', 'result', 'redo', 'concept', 'category']);

  function go(v) { view = v; refresh(); window.scrollTo(0, 0); }
  function refresh() {
    document.body.classList.toggle('focus', FOCUS.has(view.name));
    tabsEl.replaceChildren(...TABS.map(([name, label]) =>
      h('button', { 'aria-current': view.name === name ? 'page' : null, onclick: () => go({ name }) }, icon(name), label)));
    main.replaceChildren(...[].concat(VIEWS[view.name](view)).filter(Boolean));
  }
  const topbar = (label, onBack, right) => h('div', { class: 'topbar' }, h('button', { onclick: onBack }, '‹ ' + label), right || h('span', {}));

  // ------------------------------------------------------------------ views
  const VIEWS = {};

  VIEWS.home = () => {
    const now = Date.now();
    const due = store.exercises.filter((e) => e.redoAt && e.redoAt <= now);
    const later = store.exercises.filter((e) => e.redoAt && e.redoAt > now).length;
    const focus = topPattern(21);
    const recent = store.exercises.slice(0, 8);
    return [
      h('div', { class: 'hero' },
        h('div', { class: 'art', innerHTML: ART }),
        h('h1', {}, store.exercises.length ? 'Ready for another one?' : 'Let’s do some calculus'),
        h('p', {}, 'Solve it on paper, take a photo, and see exactly where it went wrong.'),
        h('button', { class: 'btn primary big', onclick: () => pickPhotos(() => go({ name: 'capture' })) }, icon('camera'), 'Take a photo'),
        h('button', { class: 'btn quiet', onclick: () => go({ name: 'confirm', draft: { exId: null, problem: { text: '', expr: '', variable: 'x' }, steps: [], note: null } }) }, 'or type it in')),
      !store.settings.key && h('div', { class: 'notice' }, 'To read photos, the app needs your DeepSeek API key. ',
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); go({ name: 'settings' }); } }, 'Add it in Settings.')),
      !storageOk && h('div', { class: 'notice bad' }, 'Your history could not be saved on this device. Export a backup from Settings.'),

      due.length ? h('h2', {}, 'Due for another try') : null,
      due.length ? h('div', { class: 'list' }, due.map((ex) =>
        h('button', { class: 'item', onclick: () => go({ name: 'redo', exId: ex.id }) },
          h('div', { class: 'grow' }, problemEl(ex.problem)), h('span', { class: 'meta' }, 'Redo ›')))) : null,
      later ? h('p', { class: 'muted small', style: 'margin-top:10px' }, later + (later === 1 ? ' exercise comes' : ' exercises come') + ' back in the next few days.') : null,

      focus ? h('h2', {}, 'What to work on') : null,
      focus ? h('div', { class: 'card' },
        h('div', {}, h('strong', {}, CATS[focus.id].name), ' — ' + focus.n + ' times in the last three weeks.'),
        h('p', { class: 'muted', style: 'margin:8px 0 0' }, CATS[focus.id].advice)) : null,

      recent.length ? h('h2', {}, 'Recent') : null,
      recent.length ? h('div', { class: 'list' }, recent.map(exerciseItem)) : null,
    ];
  };

  function exerciseItem(ex) {
    const label = { correct: 'Correct', wrong: 'Check line ' + ((lastAttempt(ex).firstWrong | 0) + 1), open: 'Unfinished' }[ex.status] || '';
    return h('button', { class: 'item', onclick: () => go({ name: 'result', exId: ex.id }) },
      h('div', { class: 'grow' }, problemEl(ex.problem), h('div', { class: 'muted small' }, fmtDate(ex.created))),
      h('span', { class: 'pill ' + ex.status }, label));
  }

  VIEWS.redo = (v) => {
    const ex = store.exercises.find((e) => e.id === v.exId);
    if (!ex) return VIEWS.home();
    return [
      topbar('Back', () => go({ name: 'home' })),
      h('h1', {}, 'Try this one again'),
      h('p', { class: 'lede' }, 'You made a mistake here ' + fmtDate(lastAttempt(ex).at).toLowerCase() + '. Solve it from scratch on paper without looking at your old work.'),
      h('div', { class: 'card' }, problemEl(ex.problem)),
      h('div', { class: 'stack', style: 'margin-top:20px' },
        h('button', { class: 'btn primary', onclick: () => go({ name: 'capture', exId: ex.id }) }, 'Photograph my new solution'),
        h('button', { class: 'btn quiet', onclick: () => { ex.redoAt = null; save(); go({ name: 'home' }); } }, 'Remove from the redo list')),
    ];
  };

  // ---- capture
  let shots = [];
  function pickPhotos(done) {
    const input = h('input', { type: 'file', accept: 'image/*', multiple: true, style: 'display:none', onchange: async (e) => {
      for (const file of e.target.files) { try { shots.push(await shrink(file)); } catch (err) { alert(err.message); } }
      input.remove();
      done();
    } });
    document.body.append(input);
    input.click();
  }
  VIEWS.capture = (v) => {
    const ex = v.exId && store.exercises.find((e) => e.id === v.exId);
    const problemInput = h('input', { type: 'text', placeholder: 'e.g. differentiate x² sin x', value: v.text || '', oninput: (e) => { v.text = e.target.value; } });
    const read = async () => {
      const images = shots.slice();
      go({ name: 'working', message: 'Reading your handwriting…' });
      try {
        const known = ex ? 'The problem is already known: ' + (ex.problem.text || ex.problem.expr) + ' (expression: ' + ex.problem.expr + '). Transcribe the solution lines.' :
          (v.text ? 'The student typed the problem as: ' + v.text : 'The problem statement is in the photo.');
        const t = await ai({ system: TRANSCRIBE, images, effort: 'low', user: known + '\nReturn the JSON transcription.' });
        const p = t.problem || {};
        shots = [];
        go({ name: 'confirm', draft: {
          exId: ex ? ex.id : null,
          problem: ex ? ex.problem : { text: p.text || v.text || '', expr: p.expr || '', variable: (p.variable || 'x').trim().slice(0, 1) || 'x' },
          steps: (t.steps || []).map((s) => ({ expr: s.expr || '', latex: s.latex || '', role: s.role === 'aside' ? 'aside' : 'main' })),
          note: t.note || null,
        } });
      } catch (e) {
        go({ name: 'capture', exId: v.exId, text: v.text, error: e instanceof Friendly ? e.message : 'Something went wrong while reading the photo.' });
      }
    };
    return [
      topbar('Cancel', () => { shots = []; go({ name: 'home' }); }),
      h('h1', {}, ex ? 'New attempt' : (shots.length ? 'Looks good?' : 'Check my work')),
      h('p', { class: 'lede' }, 'Hold the phone straight above the page, in good light.'),
      v.error && h('div', { class: 'notice bad' }, v.error),
      ex ? h('div', { class: 'card' }, problemEl(ex.problem)) : h('label', { class: 'field' }, h('span', {}, 'Problem (leave empty if it is in the photo)'), problemInput),
      shots.length ? h('div', { class: 'thumbs' }, shots.map((src, i) => h('div', { class: 'thumb' }, h('img', { src, alt: 'Page ' + (i + 1) }),
        h('button', { 'aria-label': 'Remove page ' + (i + 1), onclick: () => { shots.splice(i, 1); refresh(); } }, '×')))) : null,
      h('div', { class: 'stack', style: 'margin-top:16px' },
        h('button', { class: 'btn' + (shots.length ? '' : ' primary'), onclick: () => pickPhotos(refresh) }, shots.length ? 'Add another page' : [icon('camera'), 'Take a photo']),
        shots.length ? h('button', { class: 'btn primary big', onclick: read }, 'Check it') : null,
        h('button', { class: 'btn quiet', onclick: () => {
          shots = [];
          go({ name: 'confirm', draft: { exId: ex ? ex.id : null, problem: ex ? ex.problem : { text: v.text || '', expr: '', variable: 'x' }, steps: [], note: null } });
        } }, 'Type the lines instead')),
      h('p', { class: 'muted small', style: 'margin-top:18px' }, 'Photos are sent to DeepSeek to be read and are not kept in the app.'),
    ];
  };

  VIEWS.working = (v) => h('div', { class: 'working' }, h('div', { class: 'dots' }, h('i', {}), h('i', {}), h('i', {})), h('div', {}, v.message));

  // ---- confirm
  VIEWS.confirm = (v) => {
    const d = v.draft, variable = d.problem.variable || 'x';
    const editProblem = () => editor({
      title: 'Problem', expr: d.problem.expr, variable, showVariable: true,
      help: 'Write D(…) for a derivative and lim(f, a) for a limit. Example: D(x^2*sin(x))',
      onSave: (expr, opts) => { d.problem.expr = expr; d.problem.variable = opts.variable || 'x'; refresh(); },
    });
    const editStep = (i) => editor({
      title: 'Line ' + (i + 1), expr: d.steps[i].expr, variable, role: d.steps[i].role,
      onSave: (expr, opts) => { d.steps[i] = { expr, latex: '', role: opts.role }; refresh(); },
      onDelete: () => { d.steps.splice(i, 1); refresh(); },
    });
    const addStep = () => editor({
      title: 'New line', expr: '', variable, role: 'main',
      onSave: (expr, opts) => { if (expr.trim()) { d.steps.push({ expr, latex: '', role: opts.role }); refresh(); } },
    });
    const unreadable = d.steps.filter((s) => { try { Engine.parse(s.expr, variable); return false; } catch (e) { return true; } }).length;
    return [
      topbar('Cancel', () => go({ name: 'home' })),
      h('h1', {}, 'Is this what you wrote?'),
      h('p', { class: 'lede' }, 'Tap any line to correct it. The check is only as good as this transcription.'),
      d.note && h('div', { class: 'notice' }, 'Unsure about: ' + d.note),
      h('div', { class: 'steps' },
        h('button', { class: 'step problem', onclick: d.exId ? null : editProblem, disabled: !!d.exId },
          h('span', { class: 'n' }, ''),
          h('div', { class: 'body' }, d.problem.expr ? problemEl(d.problem) : h('div', { class: 'muted' }, d.problem.text || 'Tap to enter the problem'),
            h('div', { class: 'tag' }, d.problem.expr ? 'Problem' : 'Problem — not in a form I can check. Tap to enter it.'))),
        d.steps.map((s, i) => h('button', { class: 'step', onclick: () => editStep(i) },
          h('span', { class: 'n' }, i + 1),
          h('div', { class: 'body' }, mathEl(stepTex(s, variable)), s.role === 'aside' ? h('div', { class: 'tag' }, 'Side work') : null)))),
      h('div', { class: 'stack', style: 'margin-top:14px' },
        h('button', { class: 'btn', onclick: addStep }, 'Add a line'),
        unreadable ? h('div', { class: 'notice' }, unreadable + (unreadable === 1 ? ' line is' : ' lines are') + ' not in a form that can be checked. Tap to fix, or continue and it will be skipped.') : null,
        h('button', { class: 'btn primary', disabled: !d.steps.length, onclick: () => runCheck(d) }, 'Check it')),
    ];
  };

  function editor(o) {
    const preview = h('div', { class: 'preview' });
    const input = h('input', { type: 'text', class: 'mono', value: o.expr || '', autocapitalize: 'off', autocorrect: 'off', spellcheck: false, 'aria-label': 'Expression' });
    const varInput = o.showVariable ? h('input', { type: 'text', class: 'mono', value: o.variable, maxLength: 1, autocapitalize: 'off', 'aria-label': 'Variable' }) : null;
    const aside = o.role ? h('input', { type: 'checkbox', checked: o.role === 'aside' }) : null;
    const show = () => {
      preview.replaceChildren();
      if (!input.value.trim()) { preview.append(h('span', { class: 'muted' }, 'Preview')); return; }
      try { preview.append(mathEl(Engine.tex(input.value, (varInput && varInput.value) || o.variable))); }
      catch (e) { preview.append(h('span', { class: 'muted' }, 'Not readable yet')); }
    };
    input.addEventListener('input', show); show();
    const close = () => sheetRoot.replaceChildren();
    const done = () => { close(); o.onSave(input.value.trim(), { role: aside && aside.checked ? 'aside' : 'main', variable: varInput && varInput.value.trim() }); };
    sheetRoot.replaceChildren(h('div', { class: 'scrim', onclick: (e) => { if (e.target.classList.contains('scrim')) close(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-label': o.title },
        h('h3', {}, o.title),
        preview, input,
        h('p', { class: 'muted small', style: 'margin:8px 0 0' }, o.help || 'Type it as you would on a calculator: 2x*cos(x^2), sqrt(x+1), e^(2x), ln(x). Side work can be an equation: D(x^2+1) = 2x'),
        varInput ? h('label', { class: 'field' }, h('span', {}, 'Variable'), varInput) : null,
        aside ? h('label', { class: 'check' }, aside, 'Side work (not a full line of the answer)') : null,
        h('div', { class: 'row', style: 'margin-top:14px' },
          o.onDelete ? h('button', { class: 'btn', onclick: () => { close(); o.onDelete(); } }, 'Delete') : null,
          h('button', { class: 'btn primary', onclick: done }, 'Done')))));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
    input.focus();
  }

  // ---- result
  const MARK = { ok: '✓', wrong: '✕', unverified: '?' };
  VIEWS.result = (v) => {
    const ex = store.exercises.find((e) => e.id === v.exId);
    if (!ex) return VIEWS.home();
    const at = lastAttempt(ex), variable = ex.problem.variable || 'x';
    const k = at.firstWrong;
    const okCount = at.results.filter((r) => r === 'ok').length;
    const unv = at.results.filter((r) => r === 'unverified').length;
    const verdict = ex.status === 'wrong' ? 'Almost! Take another look at line ' + (k + 1) + '.'
      : ex.status === 'correct' ? 'Every line checks out. Nice work!'
      : okCount ? 'Correct so far. Keep going!' : 'Nothing here could be checked.';
    const sub = ex.status === 'wrong' ? (k === 0 ? 'It does not follow from the problem.' : (k === 1 ? 'Line 1 is fine' : 'Lines 1–' + k + ' are fine') + '. Look at how you got from line ' + k + ' to line ' + (k + 1) + '.')
      : okCount + (okCount === 1 ? ' line' : ' lines') + ' verified by calculation' + (unv ? ', ' + unv + ' could not be checked.' : '.');

    const out = [
      topbar('Done', () => go({ name: 'home' }), h('button', { onclick: () => { if (confirm('Delete this exercise from your history?')) { store.exercises = store.exercises.filter((e) => e !== ex); save(); go({ name: 'home' }); } } }, 'Delete')),
      h('div', { class: 'banner ' + ex.status }, h('div', { class: 'verdict' }, verdict), h('p', {}, sub)),
      h('div', { class: 'steps' },
        h('div', { class: 'step problem' }, h('span', { class: 'n' }, ''), h('div', { class: 'body' }, problemEl(ex.problem), h('div', { class: 'tag' }, 'Problem'))),
        at.steps.map((s, i) => h('div', { class: 'step' + (i === k ? ' first-wrong' : '') + (k >= 0 && i > k ? ' after' : '') },
          h('span', { class: 'n' }, i + 1),
          h('div', { class: 'body' }, mathEl(stepTex(s, variable)),
            (s.role === 'aside' || (at.results[i] === 'unverified' && at.reasons && at.reasons[i])) ?
              h('div', { class: 'tag' }, [s.role === 'aside' ? 'Side work' : null, at.results[i] === 'unverified' ? at.reasons[i] : null].filter(Boolean).join(' · ')) : null),
          h('span', { class: 'mark ' + at.results[i], role: 'img', 'aria-label': at.results[i] }, MARK[at.results[i]])))),
    ];

    if (ex.status === 'wrong') out.push(diagPanel(ex, at));
    if (ex.status === 'open' && okCount) out.push(nudgePanel(ex, at));

    out.push(h('div', { class: 'stack', style: 'margin-top:22px' },
      ex.status !== 'correct' ? h('button', { class: 'btn primary', onclick: () => go({ name: 'capture', exId: ex.id }) }, ex.status === 'wrong' ? 'Photograph my corrected work' : 'Photograph the rest') : null,
      ex.status === 'wrong' ? h('p', { class: 'muted small', style: 'text-align:center' }, 'This one will come back in three days so you can do it cold.') : null));
    return out;
  };

  function diagPanel(ex, at) {
    const d = at.diagnosis;
    if (at.diagnosing) return h('div', { class: 'diag' }, h('div', { class: 'dots', style: 'margin-bottom:10px' }, h('i', {}), h('i', {}), h('i', {})), h('div', { style: 'text-align:center' }, 'Working out what happened on that line…'));
    if (!d) return h('div', { class: 'diag' },
      h('p', {}, at.diagError || 'No explanation yet.'),
      h('button', { class: 'btn', onclick: () => diagnose(ex, at) }, 'Ask for an explanation'));
    const lvl = at.hintsShown || 0;
    const variable = ex.problem.variable || 'x';
    const parts = [h('div', { class: 'label' }, 'Look here'), h('div', {}, rich(d.hint1))];
    if (lvl >= 1) parts.push(h('div', { class: 'label' }, 'The idea'), h('div', {}, rich(d.hint2)));
    if (lvl >= 2) {
      parts.push(h('div', { class: 'label' }, 'What happened'), h('div', {}, h('span', { class: 'chip' }, CATS[d.category].name)), h('div', { style: 'margin-top:8px' }, rich(d.what)));
      if (d.conceptual && d.concept) parts.push(h('div', { class: 'label' }, 'What it means'), h('div', {}, rich(d.concept)));
    }
    if (lvl >= 3) {
      parts.push(h('div', { class: 'label' }, 'Corrected line'));
      parts.push(d.fix.verified ? h('div', {}, mathEl(stepTex({ expr: d.fix.expr }, variable)), h('div', { class: 'muted small' }, 'Verified by calculation.'))
        : h('div', { class: 'muted' }, 'The AI’s correction did not pass the check, so it is not shown. Use the hints above.'));
    }
    const next = ['Another hint', 'Show what went wrong', 'Show the corrected line'][lvl];
    return h('div', {},
      h('div', { class: 'diag' }, parts),
      next ? h('button', { class: 'btn', onclick: () => { at.hintsShown = lvl + 1; save(); refresh(); } }, next) : null,
      lvl === 0 ? h('p', { class: 'muted small', style: 'margin-top:10px;text-align:center' }, 'Try to fix it on paper before asking for more.') : null);
  }

  function nudgePanel(ex, at) {
    const n = at.nudge;
    if (at.nudging) return h('div', { class: 'diag calm' }, h('span', { class: 'muted' }, 'Thinking about your next step…'));
    if (!n) return h('div', { style: 'margin-top:18px' },
      at.nudgeError ? h('div', { class: 'notice bad' }, at.nudgeError) : null,
      h('button', { class: 'btn', onclick: () => nudge(ex, at) }, 'I’m stuck — give me a nudge'));
    const parts = [h('div', { class: 'label' }, 'Notice'), h('div', {}, rich(n.hint1))];
    if (n.shown >= 1) parts.push(h('div', { class: 'label' }, 'The idea'), h('div', {}, rich(n.hint2)));
    if (n.shown >= 2) {
      parts.push(h('div', { class: 'label' }, 'Next line'));
      parts.push(n.next.verified ? h('div', {}, mathEl(stepTex({ expr: n.next.expr }, ex.problem.variable || 'x')), h('div', { class: 'muted small' }, 'Verified by calculation.'))
        : h('div', { class: 'muted' }, 'The AI’s suggested line did not pass the check, so it is not shown.'));
    }
    const next = ['Another hint', 'Show the next line'][n.shown];
    return h('div', {}, h('div', { class: 'diag calm' }, parts),
      next ? h('button', { class: 'btn', onclick: () => { n.shown++; save(); refresh(); } }, next) : null);
  }

  // ---- patterns
  function mistakes(sinceDays) {
    const since = sinceDays ? Date.now() - sinceDays * DAY : 0;
    const out = [];
    store.exercises.forEach((ex) => ex.attempts.forEach((a) => {
      if (a.diagnosis && a.at >= since) out.push({ ex, a, id: a.diagnosis.category });
    }));
    return out;
  }
  function topPattern(days) {
    const counts = {};
    mistakes(days).forEach((m) => { if (m.id !== 'other') counts[m.id] = (counts[m.id] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top && top[1] >= 2 ? { id: top[0], n: top[1] } : null;
  }

  VIEWS.patterns = () => {
    const all = mistakes(0), recent = mistakes(30);
    const counts = {};
    all.forEach((m) => { (counts[m.id] = counts[m.id] || { all: 0, recent: 0, last: 0 }).all++; counts[m.id].last = Math.max(counts[m.id].last, m.a.at); });
    recent.forEach((m) => { counts[m.id].recent++; });
    const rows = Object.entries(counts).sort((a, b) => b[1].recent - a[1].recent || b[1].all - a[1].all);
    const max = Math.max(1, ...rows.map((r) => r[1].all));
    const total = store.exercises.length;
    const clean = store.exercises.filter((e) => e.attempts[0] && e.attempts[0].firstWrong < 0).length;
    const depth = all.length ? (all.reduce((s, m) => s + (m.a.hintsShown || 0), 0) / all.length) : 0;
    if (!total) return [h('h1', {}, 'Patterns'), h('p', { class: 'lede' }, 'Once you have checked a few exercises, the kinds of mistakes you make will be counted here.')];
    return [
      h('h1', {}, 'Patterns'),
      h('p', { class: 'lede' }, total + (total === 1 ? ' exercise' : ' exercises') + ' checked. ' + clean + ' right on the first attempt.'),
      rows.length ? h('h2', {}, 'Mistakes by kind') : h('p', { class: 'muted' }, 'No mistakes recorded yet.'),
      rows.length ? h('div', { class: 'list' }, rows.map(([id, c]) =>
        h('button', { class: 'bar-row', onclick: () => go({ name: 'category', id }) },
          h('div', { class: 'head' }, h('span', {}, CATS[id].name), h('span', { class: 'muted small' }, c.all + ' total · ' + c.recent + ' this month')),
          h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(100 * c.all / max) + '%' }))))) : null,
      all.length ? h('h2', {}, 'Hints needed') : null,
      all.length ? h('div', { class: 'card' }, 'On average you opened ' + depth.toFixed(1) + ' of 3 extra hints before fixing a mistake. Lower means you are finding errors yourself.') : null,
    ];
  };

  VIEWS.category = (v) => {
    const list = mistakes(0).filter((m) => m.id === v.id).sort((a, b) => b.a.at - a.a.at);
    return [
      topbar('Patterns', () => go({ name: 'patterns' })),
      h('h1', {}, CATS[v.id].name),
      h('p', { class: 'lede' }, CATS[v.id].advice),
      h('div', { class: 'list' }, list.map((m) => h('button', { class: 'item', onclick: () => go({ name: 'result', exId: m.ex.id }) },
        h('div', { class: 'grow' }, problemEl(m.ex.problem), h('div', { class: 'muted small' }, rich(m.a.diagnosis.what))),
        h('span', { class: 'meta' }, fmtDate(m.a.at))))),
    ];
  };

  // ---- concepts
  const TOPICS = ['Limit', 'Continuity', 'Derivative', 'Differentiable vs continuous', 'Chain rule', 'Indeterminate forms', 'L’Hôpital’s rule', 'One-sided limits'];
  VIEWS.concepts = (v) => {
    const input = h('input', { type: 'text', placeholder: 'e.g. why 0/0 is not a number' });
    const ask = async (q) => {
      q = q.trim(); if (!q) return;
      go({ name: 'working', message: 'Preparing an explanation…' });
      try {
        const card = await ai({ system: CONCEPT, effort: 'high', user: 'Concept: ' + q + '\nReturn the JSON.' });
        store.concepts.unshift({ q, at: Date.now(), card }); save();
        go({ name: 'concept', i: 0 });
      } catch (e) { go({ name: 'concepts', error: e instanceof Friendly ? e.message : 'Something went wrong.' }); }
    };
    return [
      h('h1', {}, 'Concepts'),
      h('p', { class: 'lede' }, 'For when you can do the steps but do not yet see what the idea means.'),
      v.error && h('div', { class: 'notice bad' }, v.error),
      h('div', { class: 'chips' }, TOPICS.map((t) => h('button', { onclick: () => ask(t) }, t))),
      h('label', { class: 'field' }, h('span', {}, 'Or ask about something specific'), input),
      h('button', { class: 'btn', onclick: () => ask(input.value) }, 'Explain it'),
      store.concepts.length ? h('h2', {}, 'Saved') : null,
      store.concepts.length ? h('div', { class: 'list' }, store.concepts.map((c, i) => h('button', { class: 'item', onclick: () => go({ name: 'concept', i }) },
        h('div', { class: 'grow' }, c.card.title || c.q), h('span', { class: 'meta' }, fmtDate(c.at))))) : null,
    ];
  };

  VIEWS.concept = (v) => {
    const c = store.concepts[v.i];
    if (!c) return VIEWS.concepts({});
    const k = c.card;
    const block = (label, text) => text ? [h('h2', {}, label), h('p', {}, rich(text))] : [];
    return [
      topbar('Concepts', () => go({ name: 'concepts' }), h('button', { onclick: () => { store.concepts.splice(v.i, 1); save(); go({ name: 'concepts' }); } }, 'Delete')),
      h('h1', {}, k.title || c.q),
      block('What it means', k.meaning), block('With numbers', k.example), block('The usual misreading', k.misreading),
      block('Check yourself', k.question),
      v.open ? h('div', { class: 'card' }, rich(k.answer)) : h('button', { class: 'btn', onclick: () => { v.open = true; refresh(); } }, 'Show the answer'),
    ].flat();
  };

  // ---- settings
  VIEWS.settings = (v) => {
    const keyInput = h('input', { type: 'password', value: store.settings.key, placeholder: 'sk-…', autocomplete: 'off', onchange: (e) => { store.settings.key = e.target.value.trim(); save(); } });
    const test = async () => {
      store.settings.key = keyInput.value.trim(); save();
      go({ name: 'settings', status: 'Testing…' });
      try { await ai({ system: 'Reply with the JSON object {"ok": true}.', user: 'Return the json.' }); go({ name: 'settings', status: 'The key works.' }); }
      catch (e) { go({ name: 'settings', status: e.message }); }
    };
    const exportData = async () => {
      const copy = JSON.parse(JSON.stringify(store)); copy.settings.key = '';
      const file = new File([JSON.stringify(copy, null, 1)], 'tangent-backup-' + new Date().toISOString().slice(0, 10) + '.json', { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch (e) { /* cancelled */ } return; }
      const a = h('a', { href: URL.createObjectURL(file), download: file.name }); document.body.append(a); a.click(); a.remove();
    };
    const importer = h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', onchange: async (e) => {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        if (!Array.isArray(data.exercises)) throw new Error();
        if (!confirm('Replace the history on this device with the ' + data.exercises.length + ' exercises in this backup?')) return;
        const key = store.settings.key;
        store = Object.assign(blank(), data); store.settings.key = store.settings.key || key; save();
        go({ name: 'settings', status: 'Backup restored.' });
      } catch (err) { go({ name: 'settings', status: 'That file is not a Tangent backup.' }); }
    } });
    return [
      h('h1', {}, 'Settings'),
      h('h2', {}, 'DeepSeek'),
      h('label', { class: 'field' }, h('span', {}, 'API key (from platform.deepseek.com, kept only on this device)'), keyInput),
      h('button', { class: 'btn', onclick: test }, 'Save and test the key'),
      v.status ? h('div', { class: 'notice' }, v.status) : null,
      h('h2', {}, 'Your data'),
      h('p', { class: 'muted' }, 'Your exercises and mistake history are stored only on this device. Export a backup now and then, and before changing phones.'),
      importer,
      h('div', { class: 'stack' },
        h('button', { class: 'btn', onclick: exportData }, 'Export a backup'),
        h('button', { class: 'btn', onclick: () => importer.click() }, 'Restore from a backup'),
        h('button', { class: 'btn quiet', onclick: () => { if (confirm('Erase all exercises, patterns and saved concepts from this device? This cannot be undone.')) { const key = store.settings.key; store = blank(); store.settings.key = key; save(); go({ name: 'settings', status: 'History erased.' }); } } }, 'Erase history')),
      h('h2', {}, 'How checking works'),
      h('p', { class: 'muted' }, 'The AI only reads your handwriting and writes hints. Whether a line is right is decided by calculation: each line is evaluated at several test values and compared with the problem itself. A “?” means a line could not be tested, not that it is wrong.'),
    ];
  };

  // ------------------------------------------------------------------ start
  window.Tangent = { go, get store() { return store; } };
  refresh();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
