// Scientific calculator: tokenizer + recursive-descent parser (no eval).
(() => {
  const exprEl = document.getElementById('expr');
  const resultEl = document.getElementById('result');
  const angleBtn = document.getElementById('angle');
  const themeBtn = document.getElementById('theme');
  const historyList = document.getElementById('history-list');

  let expr = '';
  let ans = 0;
  let degrees = true;
  let justEvaluated = false;
  let history = load('calc-history', []);

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }

  // ---------- Tokenizer ----------
  const FUNCS = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'sqrt', 'ln', 'log', 'abs'];

  function tokenize(src) {
    const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt');
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ') { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        if (s[j] === 'E') {
          j++;
          if (s[j] === '+' || s[j] === '-') j++;
          while (j < s.length && /[0-9]/.test(s[j])) j++;
        }
        const text = s.slice(i, j);
        const n = Number(text);
        if (Number.isNaN(n)) throw new Error('Invalid number');
        tokens.push({ t: 'num', v: n });
        i = j;
        continue;
      }
      if (c === 'π') { tokens.push({ t: 'num', v: Math.PI }); i++; continue; }
      if (/[a-z]/i.test(c)) {
        let j = i;
        while (j < s.length && /[a-z]/i.test(s[j])) j++;
        const word = s.slice(i, j);
        if (word === 'e') tokens.push({ t: 'num', v: Math.E });
        else if (word === 'pi') tokens.push({ t: 'num', v: Math.PI });
        else if (word === 'Ans') tokens.push({ t: 'num', v: ans });
        else if (FUNCS.includes(word)) tokens.push({ t: 'fn', v: word });
        else throw new Error(`Unknown: ${word}`);
        i = j;
        continue;
      }
      if ('+-*/^()!%'.includes(c)) { tokens.push({ t: 'op', v: c }); i++; continue; }
      throw new Error(`Unexpected "${c}"`);
    }
    return insertImplicitMultiplication(tokens);
  }

  // 2π, 3(4), (2)(3), 2sin(x), π e  → insert '*'
  function insertImplicitMultiplication(tokens) {
    const out = [];
    for (const tok of tokens) {
      const prev = out[out.length - 1];
      const prevEnds = prev && (prev.t === 'num' || (prev.t === 'op' && (prev.v === ')' || prev.v === '!' || prev.v === '%')));
      const curStarts = tok.t === 'num' || tok.t === 'fn' || (tok.t === 'op' && tok.v === '(');
      if (prevEnds && curStarts) out.push({ t: 'op', v: '*' });
      out.push(tok);
    }
    return out;
  }

  // ---------- Parser ----------
  // expr   := term (('+'|'-') term)*
  // term   := unary (('*'|'/') unary)*
  // unary  := ('-'|'+') unary | power
  // power  := postfix ('^' unary)?          (right-assoc)
  // postfix:= primary ('!' | '%')*
  // primary:= num | fn '(' expr ')' | '(' expr ')'
  function evaluate(src) {
    const tokens = tokenize(src);
    let pos = 0;
    const peek = () => tokens[pos];
    const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
    const expect = (v) => {
      if (!isOp(v)) throw new Error(`Expected "${v}"`);
      pos++;
    };

    const toRad = (x) => (degrees ? (x * Math.PI) / 180 : x);
    const fromRad = (x) => (degrees ? (x * 180) / Math.PI : x);
    const cleanTrig = (x) => (Math.abs(x) < 1e-12 ? 0 : x);

    const fns = {
      sin: (x) => cleanTrig(Math.sin(toRad(x))),
      cos: (x) => cleanTrig(Math.cos(toRad(x))),
      tan: (x) => {
        if (degrees && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-12) throw new Error('Undefined');
        return cleanTrig(Math.tan(toRad(x)));
      },
      asin: (x) => fromRad(Math.asin(x)),
      acos: (x) => fromRad(Math.acos(x)),
      atan: (x) => fromRad(Math.atan(x)),
      sqrt: (x) => { if (x < 0) throw new Error('Invalid input'); return Math.sqrt(x); },
      ln: (x) => { if (x <= 0) throw new Error('Invalid input'); return Math.log(x); },
      log: (x) => { if (x <= 0) throw new Error('Invalid input'); return Math.log10(x); },
      abs: Math.abs,
    };

    function factorial(n) {
      if (n < 0 || !Number.isInteger(n)) throw new Error('Factorial needs a whole number ≥ 0');
      if (n > 170) return Infinity;
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return r;
    }

    function parseExpr() {
      let v = parseTerm();
      while (isOp('+') || isOp('-')) {
        const op = tokens[pos++].v;
        const r = parseTerm();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function parseTerm() {
      let v = parseUnary();
      while (isOp('*') || isOp('/')) {
        const op = tokens[pos++].v;
        const r = parseUnary();
        if (op === '/') {
          if (r === 0) throw new Error('Cannot divide by zero');
          v /= r;
        } else v *= r;
      }
      return v;
    }
    function parseUnary() {
      if (isOp('-')) { pos++; return -parseUnary(); }
      if (isOp('+')) { pos++; return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      const base = parsePostfix();
      if (isOp('^')) { pos++; return Math.pow(base, parseUnary()); }
      return base;
    }
    function parsePostfix() {
      let v = parsePrimary();
      while (isOp('!') || isOp('%')) {
        v = tokens[pos++].v === '!' ? factorial(v) : v / 100;
      }
      return v;
    }
    function parsePrimary() {
      const tok = peek();
      if (!tok) throw new Error('Incomplete expression');
      if (tok.t === 'num') { pos++; return tok.v; }
      if (tok.t === 'fn') {
        pos++;
        expect('(');
        const arg = parseExpr();
        expect(')');
        return fns[tok.v](arg);
      }
      if (isOp('(')) {
        pos++;
        const v = parseExpr();
        expect(')');
        return v;
      }
      throw new Error('Syntax error');
    }

    if (tokens.length === 0) return 0;
    const value = parseExpr();
    if (pos < tokens.length) throw new Error('Syntax error');
    if (Number.isNaN(value)) throw new Error('Invalid input');
    return value;
  }

  // Auto-close open parentheses for live preview / evaluation.
  function balanced(s) {
    const open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
    return open > 0 ? s + ')'.repeat(open) : s;
  }

  function format(n) {
    if (!Number.isFinite(n)) return n > 0 ? '∞' : '−∞';
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1e15 || abs < 1e-9) return n.toExponential(8).replace(/\.?0+e/, 'e');
    return String(parseFloat(n.toPrecision(12)));
  }

  // ---------- UI ----------
  function render(previewOnly = true) {
    exprEl.textContent = expr;
    resultEl.classList.remove('error');
    if (!expr) {
      resultEl.textContent = justEvaluated ? resultEl.textContent : '0';
      resultEl.classList.remove('preview');
      return;
    }
    if (previewOnly) {
      try {
        resultEl.textContent = format(evaluate(balanced(expr)));
        resultEl.classList.add('preview');
      } catch {
        resultEl.classList.add('preview');
        resultEl.textContent = '';
      }
    }
  }

  function insert(text) {
    if (justEvaluated) {
      // Continue from the previous answer when an operator is pressed; start fresh otherwise.
      if (/^[+×÷−^!%]$/.test(text)) expr = 'Ans';
      else expr = '';
      justEvaluated = false;
    }
    expr += text;
    render();
  }

  function backspace() {
    if (justEvaluated) { clearAll(); return; }
    const m = expr.match(/(asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|sqrt\(|ln\(|log\(|abs\(|Ans)$/);
    expr = m ? expr.slice(0, -m[0].length) : expr.slice(0, -1);
    render();
  }

  function clearAll() {
    expr = '';
    justEvaluated = false;
    resultEl.textContent = '0';
    render();
  }

  function equals() {
    if (!expr) return;
    const shown = balanced(expr);
    try {
      const value = evaluate(shown);
      ans = value;
      const out = format(value);
      exprEl.textContent = shown + ' =';
      resultEl.textContent = out;
      resultEl.classList.remove('preview', 'error');
      history.unshift({ expr: shown, result: out, value });
      history = history.slice(0, 50);
      save('calc-history', history);
      renderHistory();
      expr = '';
      justEvaluated = true;
    } catch (err) {
      resultEl.textContent = err.message || 'Error';
      resultEl.classList.remove('preview');
      resultEl.classList.add('error');
    }
  }

  function renderHistory() {
    historyList.replaceChildren(...history.map((h) => {
      const li = document.createElement('li');
      li.title = 'Use this result';
      const e = document.createElement('span'); e.className = 'h-expr'; e.textContent = h.expr;
      const r = document.createElement('span'); r.className = 'h-res'; r.textContent = h.result;
      li.append(e, r);
      li.addEventListener('click', () => {
        if (justEvaluated) { expr = ''; justEvaluated = false; }
        expr += `(${h.expr})`;
        render();
      });
      return li;
    }));
  }

  document.getElementById('keys').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.in) insert(btn.dataset.in);
    else if (btn.dataset.fn) insert(btn.dataset.fn);
    else if (btn.dataset.act === 'clear') clearAll();
    else if (btn.dataset.act === 'back') backspace();
    else if (btn.dataset.act === 'eq') equals();
    else if (btn.dataset.act === 'ans') insert('Ans');
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const map = { '*': '×', '/': '÷', '-': '−', 'x': '×' };
    if (/^[0-9.+^()!%]$/.test(k)) insert(k);
    else if (map[k]) insert(map[k]);
    else if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); }
    else if (k === 'Backspace') backspace();
    else if (k === 'Escape' || k === 'Delete') clearAll();
    else if (k === 'p') insert('π');
    else if (k === 'e') insert('e');
    else if (k === 's') insert('sin(');
    else if (k === 'c') insert('cos(');
    else if (k === 't') insert('tan(');
    else if (k === 'l') insert('ln(');
    else if (k === 'r') insert('sqrt(');
    else return;
    e.preventDefault();
  });

  angleBtn.addEventListener('click', () => {
    degrees = !degrees;
    angleBtn.textContent = degrees ? 'DEG' : 'RAD';
    save('calc-degrees', degrees);
    render();
  });

  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    save('calc-theme', next);
  });

  document.getElementById('clear-history').addEventListener('click', () => {
    history = [];
    save('calc-history', history);
    renderHistory();
  });

  // Init
  degrees = load('calc-degrees', true);
  angleBtn.textContent = degrees ? 'DEG' : 'RAD';
  const theme = load('calc-theme', null);
  if (theme) document.documentElement.dataset.theme = theme;
  renderHistory();
  render();

  window.__calcEvaluate = evaluate; // exposed for quick testing
})();
