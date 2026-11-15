/* Deterministic step checker.
 *
 * The AI never decides whether a line of maths is right. It only transcribes
 * each line into an expression; this file decides, by evaluating every line
 * at sample points and comparing it with the problem itself.
 *
 * Expression syntax is math.js, plus two operators:
 *   D(f)            derivative of f with respect to the problem variable
 *   lim(f, a)       limit of f as the variable -> a   (a may be Infinity)
 *   lim(f, a, 1)    right-hand limit;  lim(f, a, -1)  left-hand limit
 */
(function (root) {
  'use strict';
  const M = root.math || (typeof require !== 'undefined' ? require('./vendor/math.js') : null);
  const m = M.create(M.all);

  const SAMPLES = [0.37, 0.83, 1.29, 1.91, 2.63, -0.71, -1.47, 3.7, 0.12];
  const PARAM_VALUES = [1.37, 0.71, 2.13, 1.61, 0.53, 2.89];
  const DNE = Symbol('limit does not exist');

  // Evaluation context shared with the D and lim operators.
  let ctx = { variable: 'x', scope: {}, err: 0 };

  function num(v) {
    if (typeof v === 'number') return v;
    if (v && typeof v.re === 'number') return Math.abs(v.im) < 1e-12 ? v.re : NaN;
    if (v && typeof v.toNumber === 'function') return v.toNumber();
    return NaN;
  }

  function evalNode(node, scope) {
    const saved = ctx.scope;
    ctx.scope = scope;
    try {
      const v = node.evaluate(Object.assign({}, scope));
      return v === DNE ? DNE : num(v);
    } catch (e) {
      return NaN;
    } finally {
      ctx.scope = saved;
    }
  }

  function evalWith(node, x, variable) {
    const s = Object.assign({}, ctx.scope);
    s[variable || ctx.variable] = x;
    const v = evalNode(node, s);
    return v === DNE ? NaN : v;
  }

  // ---- D: numeric derivative (used only when symbolic differentiation fails)
  function D(args) {
    const f = args[0];
    const x = ctx.scope[ctx.variable];
    const h = 1e-3 * Math.max(1, Math.abs(x));
    const cd = (k) => (evalWith(f, x + k) - evalWith(f, x - k)) / (2 * k);
    return (4 * cd(h / 2) - cd(h)) / 3;
  }
  D.rawArgs = true;

  // ---- lim: numeric limit by Richardson extrapolation
  function oneSided(f, a, side, variable) {
    const N = 8;
    const vals = [];
    for (let k = 0; k < N; k++) {
      const h = 0.1 / Math.pow(2, k);
      const x = Number.isFinite(a) ? a + side * h : (a > 0 ? 1 : -1) / h;
      const v = evalWith(f, x, variable);
      if (!Number.isFinite(v)) return { v: null };
      vals.push(v);
    }
    const abs = vals.map(Math.abs);
    const growing = abs[N - 1] > abs[N - 2] && abs[N - 2] > abs[N - 3] && abs[N - 3] > abs[N - 4];
    if (growing && abs[N - 1] > 1e3 && abs[N - 1] / abs[N - 2] > 1.4) {
      return { v: vals[N - 1] > 0 ? Infinity : -Infinity, err: 0 };
    }
    let T = vals.slice();
    let prevDiag = T[0];
    let est = T[N - 1];
    let err = Infinity;
    for (let j = 1; j < N; j++) {
      const next = [];
      for (let k = j; k < N; k++) {
        const i = k - j;
        next.push(T[i + 1] + (T[i + 1] - T[i]) / (Math.pow(2, j) - 1));
      }
      T = next;
      const e = Math.abs(T[0] - prevDiag);
      if (e < err) { err = e; est = T[0]; }
      prevDiag = T[0];
    }
    const rawErr = Math.abs(vals[N - 1] - vals[N - 2]);
    if (rawErr < err) { err = rawErr; est = vals[N - 1]; }
    if (err > 2e-3 * (1 + Math.abs(est))) return { v: null };
    return { v: est, err };
  }

  function lim(args) {
    const f = args[0];
    // lim(f, a [, side])  or  lim(f, h, a [, side]) for a limit in another variable
    let variable = ctx.variable, rest = args.slice(1);
    if (rest.length >= 2 && rest[0].type === 'SymbolNode' && !(rest[0].name in m)) { variable = rest[0].name; rest = rest.slice(1); }
    const a = num(rest[0].evaluate(Object.assign({}, ctx.scope)));
    const side = rest[1] ? num(rest[1].evaluate(Object.assign({}, ctx.scope))) : 0;
    if (Number.isNaN(a)) return NaN;
    let r;
    if (!Number.isFinite(a) || side !== 0) {
      r = oneSided(f, a, side >= 0 ? 1 : -1, variable);
      if (r.v === null) return NaN;
    } else {
      const R = oneSided(f, a, 1, variable), L = oneSided(f, a, -1, variable);
      if (R.v === null && L.v === null) return NaN;
      if (R.v === null) r = L;
      else if (L.v === null) r = R;
      else if (same(R.v, L.v, R.err + L.err)) r = { v: Number.isFinite(R.v) ? (R.v + L.v) / 2 : R.v, err: R.err + L.err };
      else return DNE;
    }
    ctx.err += r.err || 0;
    return r.v;
  }
  lim.rawArgs = true;

  m.import({ D, lim }, { override: true });

  function same(a, b, extra) {
    if (a === DNE || b === DNE) return a === b;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
    return Math.abs(a - b) <= 1e-6 + 1e-5 * Math.max(Math.abs(a), Math.abs(b)) + 20 * (extra || 0);
  }

  // ---- parsing
  function normalise(s) {
    return String(s)
      .replace(/[·×⋅]/g, '*').replace(/[−–]/g, '-').replace(/÷/g, '/')
      .replace(/π/g, 'pi').replace(/∞/g, 'Infinity')
      .replace(/\*\*/g, '^')
      .replace(/\b(inf|infty|infinity|oo)\b/gi, 'Infinity')
      .replace(/\bln\b/g, 'log')
      .replace(/\barc(sin|cos|tan|cot|sec|csc)\b/g, 'a$1')
      .replace(/\btg\b/g, 'tan');
  }

  function splitSides(s) {
    // split on top-level '=' (ignoring ==, <=, >=)
    const out = [];
    let depth = 0, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (c === '=' && depth === 0 && s[i + 1] !== '=' && !'<>=!'.includes(s[i - 1] || ' ')) {
        out.push(cur); cur = '';
      } else cur += c;
    }
    out.push(cur);
    return out.map((t) => t.trim()).filter(Boolean);
  }

  // Replace D(...) by a symbolic derivative wherever math.js can do it.
  function resolveD(node, variable) {
    const mapped = node.map((child) => resolveD(child, variable));
    if (mapped.type === 'FunctionNode' && mapped.fn && mapped.fn.name === 'D' && mapped.args.length === 1) {
      try { return m.derivative(mapped.args[0], variable, { simplify: false }); } catch (e) { /* numeric fallback */ }
    }
    return mapped;
  }

  // "2x(x-3)" is read by math.js as a call of a function named x; turn it back into a product.
  function fixCalls(node) {
    const mapped = node.map(fixCalls);
    if (mapped.type === 'FunctionNode' && mapped.fn && mapped.fn.name && mapped.args.length === 1 &&
        typeof m[mapped.fn.name] !== 'function') {
      return new m.OperatorNode('*', 'multiply', [new m.SymbolNode(mapped.fn.name), new m.ParenthesisNode(mapped.args[0])], true);
    }
    return mapped;
  }
  const read = (s) => fixCalls(m.parse(s));

  function parse(str, variable) {
    const sides = splitSides(normalise(str));
    if (!sides.length) throw new Error('empty');
    return sides.map((s) => resolveD(read(s), variable || 'x'));
  }

  function freeSymbols(nodes, variable) {
    const names = new Set();
    nodes.forEach((n) => n.traverse((node, path, parent) => {
      if (node.type !== 'SymbolNode') return;
      if (parent && parent.type === 'FunctionNode' && parent.fn === node) return;
      if (node.name === variable || node.name in m) return;
      names.add(node.name);
    }));
    return [...names].sort();
  }

  // Evaluate each node at every sample point -> array of {v, err}
  function table(nodes, variable, params) {
    return SAMPLES.map((x) => {
      const scope = {};
      params.forEach((p, i) => { scope[p] = PARAM_VALUES[i % PARAM_VALUES.length]; });
      scope[variable] = x;
      return nodes.map((n) => {
        ctx = { variable, scope, err: 0 };
        const v = evalNode(n, scope);
        return { v, err: ctx.err };
      });
    });
  }

  const usable = (c) => c.v === DNE || c.v === Infinity || c.v === -Infinity || Number.isFinite(c.v);

  // Compare a group of nodes against a reference node. Returns ok | wrong | unverified.
  function compare(refNode, nodes, variable) {
    const all = [refNode, ...nodes];
    const params = freeSymbols(all, variable);
    const rows = table(all, variable, params);
    let valid = 0;
    for (const row of rows) {
      if (!row.every(usable)) continue;
      valid++;
      for (let i = 1; i < row.length; i++) {
        if (!same(row[0].v, row[i].v, row[0].err + row[i].err)) return 'wrong';
      }
    }
    return valid >= 3 ? 'ok' : 'unverified';
  }

  /* problem: { expr, variable }   steps: [{ role: 'main'|'aside', expr }]
   * returns { results: [{status, reason}], firstWrong } */
  function check(problem, steps) {
    const variable = (problem && problem.variable) || 'x';
    let ref = null, refError = null;
    if (problem && problem.expr) {
      try { ref = parse(problem.expr, variable)[0]; } catch (e) { refError = 'The problem itself could not be read as an expression.'; }
    }
    const results = steps.map((step) => {
      if (!step.expr || !String(step.expr).trim()) return { status: 'unverified', reason: 'No expression to check on this line.' };
      let sides;
      try { sides = parse(step.expr, variable); } catch (e) { return { status: 'unverified', reason: 'This line could not be read as an expression.' }; }
      let status;
      if (step.role === 'aside') {
        if (sides.length < 2) return { status: 'unverified', reason: 'Side work without an equation to test.' };
        if (sides.some((n) => n.type === 'SymbolNode' && n.name !== variable && !(n.name in m))) {
          return { status: 'unverified', reason: 'A definition, not a calculation.' };
        }
        status = compare(sides[0], sides.slice(1), variable);
      } else {
        if (!ref) return { status: 'unverified', reason: refError || 'This kind of problem cannot be checked automatically yet.' };
        status = compare(ref, sides, variable);
      }
      return { status, reason: status === 'unverified' ? 'Could not be evaluated reliably at enough test points.' : '' };
    });
    return { results, firstWrong: results.findIndex((r) => r.status === 'wrong') };
  }

  // ---- LaTeX for an expression the user edited by hand
  function tex(str, variable) {
    variable = variable || 'x';
    const handler = (node, options) => {
      if (node.type === 'FunctionNode' && node.fn && node.fn.name === 'D') {
        return '\\frac{d}{d' + variable + '}\\left[' + node.args[0].toTex(options) + '\\right]';
      }
      if (node.type === 'FunctionNode' && node.fn && node.fn.name === 'lim' && node.args.length >= 2) {
        let v = variable, rest = node.args.slice(1);
        if (rest.length >= 2 && rest[0].type === 'SymbolNode' && !(rest[0].name in m)) { v = rest[0].name; rest = rest.slice(1); }
        let sideTex = '';
        if (rest[1]) sideTex = /-/.test(rest[1].toString()) ? '^{-}' : '^{+}';
        return '\\lim_{' + v + '\\to ' + rest[0].toTex(options) + sideTex + '}\\left(' + node.args[0].toTex(options) + '\\right)';
      }
      if (node.type === 'SymbolNode' && node.name === 'Infinity') return '\\infty';
      return undefined;
    };
    return splitSides(normalise(str)).map((s) => read(s).toTex({ handler, parenthesis: 'auto', implicit: 'hide' })).join(' = ');
  }

  root.Engine = { check, tex, parse, normalise };
  if (typeof module !== 'undefined') module.exports = root.Engine;
})(typeof window !== 'undefined' ? window : globalThis);
