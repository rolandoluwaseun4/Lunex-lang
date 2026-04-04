// ─────────────────────────────────────────
//  Lunex Browser Runtime v0.9
//  Include in any HTML page, then write:
//  <script type="text/lunex"> … </script>
// ─────────────────────────────────────────

(function () {

function output(val) {
const el = document.getElementById(‘lunex-output’);
if (el) {
const line = document.createElement(‘div’);
line.textContent = val;
el.appendChild(line);
} else {
console.log(’[Lunex]’, val);
}
}

function getAppRoot() {
return document.getElementById(‘lunex-app’) || document.body;
}

const elements = {};

// ── Main interpreter ─────────────────────
async function lunex(code) {
const lines = code.split(’\n’).map(l => l.trim()).filter(l => l && !l.startsWith(’//’));
const vars = {};
const funcs = {};

```
// Pass 1 — collect function definitions
let i = 0;
while (i < lines.length) {
  if (lines[i].startsWith('assign ')) {
    const funcName = lines[i].slice(7).replace(/:$/, '').trim();
    const body = [];
    i++;
    while (i < lines.length && !lines[i].startsWith('end')) {
      body.push(lines[i]);
      i++;
    }
    funcs[funcName] = body;
  }
  i++;
}

// Pass 2 — execute
i = 0;
while (i < lines.length) {
  if (lines[i].startsWith('assign ')) {
    i++;
    while (i < lines.length && !lines[i].startsWith('end')) i++;
    i++; continue;
  }
  try {
    await runLine(lines[i], vars, funcs);
  } catch (err) {
    // Per-line catch — one bad line never kills the whole page
    console.warn(`[Lunex] Line error: "${lines[i].slice(0, 60)}" →`, err.message);
  }
  i++;
}
```

}

// ── Run a single line ────────────────────
async function runLine(line, vars, funcs) {
line = line.trim();

```
if (line.startsWith('dsp ')) {
  output(evaluate(line.slice(4).replace(/\.$/, '').trim(), vars));
}

else if (line.startsWith('make ')) {
  const raw = line.slice(5).replace(/\.$/, '').trim();
  const eq = raw.indexOf('=');
  if (eq === -1) return;
  vars[raw.slice(0, eq).trim()] = evaluate(raw.slice(eq + 1).trim(), vars);
}

else if (line.startsWith('store ')) {
  const raw = line.replace(/\.$/, '').slice(6).trim();
  const ai = raw.indexOf(' ask ');
  if (ai === -1) return;
  const varName = raw.slice(0, ai).trim();
  const question = raw.slice(ai + 5).trim().replace(/^"|"$/g, '');
  const answer = window.prompt(question) || '';
  vars[varName] = isNaN(answer) || answer === '' ? answer : Number(answer);
}

else if (line.startsWith('if ')) {
  const ci = line.indexOf(':');
  if (ci === -1) return;
  const cond = line.slice(3, ci).trim();
  const rest = line.slice(ci + 1).trim();
  const oi = rest.toLowerCase().indexOf('otherwise:');
  let thenPart = rest, elsePart = null;
  if (oi !== -1) { thenPart = rest.slice(0, oi).trim(); elsePart = rest.slice(oi + 10).trim(); }
  if (evalCond(cond, vars)) await runLine(thenPart, vars, funcs);
  else if (elsePart) await runLine(elsePart, vars, funcs);
}

else if (line.startsWith('loop ')) {
  const ci = line.indexOf(':');
  if (ci === -1) return;
  const def = line.slice(5, ci).trim();
  const body = line.slice(ci + 1).trim();
  if (def.endsWith('times')) {
    const n = Number(evaluate(def.slice(0, def.lastIndexOf('times')).trim(), vars));
    for (let k = 0; k < n; k++) { vars['index'] = k + 1; await runLine(body, vars, funcs); }
  } else if (def.startsWith('through ')) {
    const list = vars[def.slice(8).trim()];
    if (!Array.isArray(list)) return;
    for (let k = 0; k < list.length; k++) { vars['item'] = list[k]; vars['index'] = k + 1; await runLine(body, vars, funcs); }
  }
}

else if (line.startsWith('rev ')) {
  vars['__return__'] = evaluate(line.slice(4).replace(/\.$/, '').trim(), vars);
}

// ── WEB COMMANDS ─────────────────────────

else if (line.startsWith('create ')) {
  const raw = line.slice(7).replace(/\.$/, '').trim();
  const ai = raw.indexOf(' as ');
  if (ai === -1) return;
  const elName = raw.slice(0, ai).trim();
  const rest = raw.slice(ai + 4).trim();
  const si = rest.search(/\s/);
  const tagName = si === -1 ? rest : rest.slice(0, si).trim();
  const propStr = si === -1 ? '' : rest.slice(si).trim();

  const el = document.createElement(tagName);
  el.id = 'lunex-' + elName;

  // iOS appearance reset
  if (tagName === 'button' || tagName === 'input') {
    el.style.webkitAppearance = 'none';
    el.style.appearance = 'none';
  }

  applyProps(el, propStr);
  elements[elName] = el;
  vars[elName] = elName;
}

else if (line.startsWith('row ')) {
  const raw = line.slice(4).replace(/\.$/, '').trim();
  const si = raw.search(/\s/);
  const elName = si === -1 ? raw : raw.slice(0, si);
  const propStr = si === -1 ? '' : raw.slice(si).trim();
  const el = document.createElement('div');
  el.id = 'lunex-' + elName;
  el.style.display = 'flex';
  el.style.flexDirection = 'row';
  el.style.alignItems = 'center';
  applyProps(el, propStr);
  elements[elName] = el;
  vars[elName] = elName;
}

else if (line.startsWith('col ')) {
  const raw = line.slice(4).replace(/\.$/, '').trim();
  const si = raw.search(/\s/);
  const elName = si === -1 ? raw : raw.slice(0, si);
  const propStr = si === -1 ? '' : raw.slice(si).trim();
  const el = document.createElement('div');
  el.id = 'lunex-' + elName;
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  applyProps(el, propStr);
  elements[elName] = el;
  vars[elName] = elName;
}

else if (line.startsWith('place ')) {
  const raw = line.slice(6).replace(/\.$/, '').trim();
  if (raw.includes(' inside ')) {
    const parts = raw.split(' inside ');
    const el = elements[parts[0].trim()];
    const parentName = parts[1].trim();
    const parent = parentName === 'page' ? getAppRoot()
      : (elements[parentName] || document.getElementById('lunex-' + parentName));
    if (el && parent) parent.appendChild(el);
  } else {
    const el = elements[raw.trim()];
    if (el) getAppRoot().appendChild(el);
  }
}

else if (line.startsWith('show ')) {
  const el = elements[line.slice(5).replace(/\.$/, '').trim()];
  if (el) el.style.display = el._prevDisplay || 'block';
}

else if (line.startsWith('hide ')) {
  const el = elements[line.slice(5).replace(/\.$/, '').trim()];
  if (el) { el._prevDisplay = el.style.display; el.style.display = 'none'; }
}

else if (line.startsWith('on ')) {
  const raw = line.slice(3).replace(/\.$/, '').trim();
  const ci = raw.indexOf(':');
  if (ci === -1) return;
  const parts = raw.slice(0, ci).trim().split(' ');
  const el = elements[parts[0].trim()];
  const event = parts[1]?.trim() || 'click';
  const action = raw.slice(ci + 1).trim();
  if (el) {
    const sv = vars, sf = funcs;
    el.addEventListener(event, () => { runLine(action, sv, sf).catch(() => {}); });
  }
}

else if (line.startsWith('change ')) {
  const raw = line.slice(7).replace(/\.$/, '').trim();
  const ti = raw.indexOf(' to ');
  if (ti === -1) return;
  const el = elements[raw.slice(0, ti).trim()];
  if (el) el.textContent = String(evaluate(raw.slice(ti + 4).trim(), vars));
}

else if (line.startsWith('get ')) {
  const raw = line.slice(4).replace(/\.$/, '').trim();
  const ai = raw.indexOf(' as ');
  if (ai === -1) return;
  const el = elements[raw.slice(0, ai).trim()];
  if (!el) return;
  const val = el.value || el.textContent;
  vars[raw.slice(ai + 4).trim()] = isNaN(val) ? val : Number(val);
}

else if (funcs[line.replace(/\.$/, '').trim()]) {
  await runFunction(line.replace(/\.$/, '').trim(), {}, vars, funcs);
}

else if (line.includes(' with ') && funcs[line.split(' with ')[0].trim()]) {
  const p = line.split(' with ');
  const fn = p[0].trim();
  const lv = { ...vars };
  p[1].replace(/\.$/, '').trim().split(',').forEach(arg => {
    const eq = arg.indexOf('=');
    if (eq !== -1) lv[arg.slice(0, eq).trim()] = evaluate(arg.slice(eq + 1).trim(), vars);
  });
  await runFunction(fn, lv, vars, funcs);
}
```

}

// ── Apply props to a DOM element ─────────────────────────────
// CSS values are applied DIRECTLY — never through evaluate()
// This fixes the bug where “space-between”, “rgba(…)”, “-2px” etc. were mangled
function applyProps(el, propStr) {
if (!propStr) return;
const re = /(\w+)=”([^”]*)”/g;
let m;
while ((m = re.exec(propStr)) !== null) {
const key = m[1];
const val = m[2]; // raw CSS value — no evaluate needed

```
  if      (key === 'text')        el.textContent = val;
  else if (key === 'html')        el.innerHTML = val;
  else if (key === 'placeholder') el.placeholder = val;
  else if (key === 'value')       el.value = val;
  else if (key === 'src')         el.src = val;
  else if (key === 'href')        el.href = val;
  else if (key === 'type')        el.type = val;
  else if (key === 'class')       el.className = val;
  else if (key === 'id')          { el.id = val; }
  else if (key === 'target')      el.target = val;
  else {
    el.style[key] = val;
    // FIX: Safari backdrop-filter — extract value directly from propStr
    // el.style.backdropFilter returns '' on Safari so we can't copy from there
    if (key === 'backdropFilter') el.style.webkitBackdropFilter = val;
  }
}
```

}

// ── Run a function ────────────────────────
async function runFunction(name, lv, vars, funcs) {
const body = funcs[name];
if (!body) return;
const scope = { …vars, …lv, **return**: undefined };
for (const line of body) {
await runLine(line, scope, funcs);
if (scope[’**return**’] !== undefined) break;
}
if (scope[’**return**’] !== undefined) vars[‘result’] = scope[’**return**’];
}

// ── Condition evaluator ───────────────────
function evalCond(cond, vars) {
for (const op of [’>=’, ‘<=’, ‘!=’, ‘>’, ‘<’, ‘=’]) {
const i = cond.indexOf(op);
if (i === -1) continue;
const l = evaluate(cond.slice(0, i).trim(), vars);
const r = evaluate(cond.slice(i + op.length).trim(), vars);
if (op === ‘>’)  return l > r;
if (op === ‘<’)  return l < r;
if (op === ‘>=’) return l >= r;
if (op === ‘<=’) return l <= r;
if (op === ‘!=’) return l != r;
if (op === ‘=’)  return l == r;
}
return false;
}

// ── Expression evaluator ─────────────────
// Used only for: dsp, make, if conditions, function args
// NOT used for CSS property values (those go through applyProps directly)
function evaluate(expr, vars) {
expr = expr.trim();

```
// List
if (expr.startsWith('[') && expr.endsWith(']'))
  return expr.slice(1, -1).split(',').map(i => evaluate(i.trim(), vars));

// Quoted string — check BEFORE arithmetic so "space-between" doesn't split on -
if ((expr.startsWith('"') && expr.endsWith('"') ||
     expr.startsWith("'") && expr.endsWith("'")) && expr.length >= 2)
  return expr.slice(1, -1);

// Number
if (expr !== '' && !isNaN(expr)) return Number(expr);

// Variable
if (Object.prototype.hasOwnProperty.call(vars, expr)) return vars[expr];

// String concatenation / arithmetic with +
// FIX: split on + only OUTSIDE quoted strings
if (expr.includes('+')) {
  const parts = splitOnOperator(expr, '+');
  if (parts.length > 1) {
    const evaled = parts.map(p => evaluate(p, vars));
    return evaled.every(p => typeof p === 'number')
      ? evaled.reduce((a, b) => a + b, 0)
      : evaled.map(p => p === undefined ? '' : p).join('');
  }
}

if (expr.includes('*')) {
  const parts = splitOnOperator(expr, '*');
  if (parts.length > 1) {
    const evaled = parts.map(p => evaluate(p, vars));
    if (evaled.every(p => typeof p === 'number')) return evaled.reduce((a, b) => a * b, 1);
  }
}

if (expr.includes('-') && !/^-[\d.]/.test(expr)) {
  const parts = splitOnOperator(expr, '-');
  if (parts.length > 1) {
    const evaled = parts.map(p => evaluate(p, vars));
    if (evaled.every(p => typeof p === 'number')) return evaled.reduce((a, b) => a - b);
  }
}

if (expr.includes('/')) {
  const parts = splitOnOperator(expr, '/');
  if (parts.length > 1) {
    const evaled = parts.map(p => evaluate(p, vars));
    if (evaled.every(p => typeof p === 'number')) return evaled.reduce((a, b) => a / b);
  }
}

return expr; // fallback — return as-is
```

}

// Split on an operator but NOT inside quoted strings
function splitOnOperator(expr, op) {
const parts = [];
let current = ‘’;
let inStr = false;
let strChar = ‘’;
for (let i = 0; i < expr.length; i++) {
const c = expr[i];
if (!inStr && (c === ‘”’ || c === “’”)) { inStr = true; strChar = c; current += c; }
else if (inStr && c === strChar) { inStr = false; current += c; }
else if (!inStr && c === op) { parts.push(current.trim()); current = ‘’; }
else { current += c; }
}
if (current.trim()) parts.push(current.trim());
return parts;
}

// ── Run all <script type="text/lunex"> tags ──
// FIX: check readyState so it works whether the page is still loading or already loaded
function runLunexScripts() {
document.querySelectorAll(‘script[type=“text/lunex”]’).forEach(script => {
lunex(script.textContent).catch(err => console.error(’[Lunex]’, err));
});
}

if (document.readyState === ‘loading’) {
window.addEventListener(‘DOMContentLoaded’, runLunexScripts);
} else {
// DOM already ready — run immediately
runLunexScripts();
}

window.lunex = lunex;

})();
