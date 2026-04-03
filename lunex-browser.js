// ─────────────────────────────────────────
//  Lunex Browser Runtime v0.8
//  Include in any HTML page, then write:
//  <script type="text/lunex"> … </script>
// ─────────────────────────────────────────

(function () {

// ── Output target ───────────────────────
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
// First pass — collect functions
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (line.startsWith('assign ')) {
    const funcName = line.slice(7).replace(/:$/, '').trim();
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

// Second pass — run
i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (line.startsWith('assign ')) {
    i++;
    while (i < lines.length && !lines[i].startsWith('end')) i++;
    i++; continue;
  }
  await runLine(line, vars, funcs);
  i++;
}
```

}

// ── Run a single line ────────────────────
async function runLine(line, vars, funcs) {
line = line.trim();

```
// dsp
if (line.startsWith('dsp ')) {
  const raw = line.slice(4).replace(/\.$/, '').trim();
  output(evaluate(raw, vars));
}

// make
else if (line.startsWith('make ')) {
  const raw = line.slice(5).replace(/\.$/, '').trim();
  const eqIndex = raw.indexOf('=');
  if (eqIndex === -1) { console.error(`Lunex: missing = in "${line}"`); return; }
  vars[raw.slice(0, eqIndex).trim()] = evaluate(raw.slice(eqIndex + 1).trim(), vars);
}

// store
else if (line.startsWith('store ')) {
  const raw = line.replace(/\.$/, '').slice(6).trim();
  const askIndex = raw.indexOf(' ask ');
  if (askIndex === -1) { console.error(`Lunex: missing ask in "${line}"`); return; }
  const varName = raw.slice(0, askIndex).trim();
  const question = raw.slice(askIndex + 5).trim().replace(/^"|"$/g, '');
  const answer = window.prompt(question);
  vars[varName] = isNaN(answer) ? answer : Number(answer);
}

// if
else if (line.startsWith('if ')) {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) { console.error(`Lunex: missing : in "${line}"`); return; }
  const conditionPart = line.slice(3, colonIndex).trim();
  const rest = line.slice(colonIndex + 1).trim();
  const otherwiseIndex = rest.toLowerCase().indexOf('otherwise:');
  let thenPart = rest, otherwisePart = null;
  if (otherwiseIndex !== -1) {
    thenPart = rest.slice(0, otherwiseIndex).trim();
    otherwisePart = rest.slice(otherwiseIndex + 10).trim();
  }
  if (evaluateCondition(conditionPart, vars)) {
    await runLine(thenPart, vars, funcs);
  } else if (otherwisePart) {
    await runLine(otherwisePart, vars, funcs);
  }
}

// loop
else if (line.startsWith('loop ')) {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) { console.error(`Lunex: missing : in "${line}"`); return; }
  const loopDef = line.slice(5, colonIndex).trim();
  const loopBody = line.slice(colonIndex + 1).trim();

  if (loopDef.endsWith('times')) {
    const count = Number(evaluate(loopDef.slice(0, loopDef.lastIndexOf('times')).trim(), vars));
    for (let i = 0; i < count; i++) {
      vars['index'] = i + 1;
      await runLine(loopBody, vars, funcs);
    }
  } else if (loopDef.startsWith('through ')) {
    const list = vars[loopDef.slice(8).trim()];
    if (!Array.isArray(list)) { console.error(`Lunex: not a list`); return; }
    for (let i = 0; i < list.length; i++) {
      vars['item'] = list[i];
      vars['index'] = i + 1;
      await runLine(loopBody, vars, funcs);
    }
  }
}

// rev
else if (line.startsWith('rev ')) {
  vars['__return__'] = evaluate(line.slice(4).replace(/\.$/, '').trim(), vars);
}

// ── WEB COMMANDS ─────────────────────────

// create elName as tag prop="val" prop="val".
else if (line.startsWith('create ')) {
  const raw = line.slice(7).replace(/\.$/, '').trim();
  const asIndex = raw.indexOf(' as ');
  if (asIndex === -1) { console.error(`Lunex: missing "as" in "${line}"`); return; }

  const elName = raw.slice(0, asIndex).trim();
  const rest = raw.slice(asIndex + 4).trim();
  const spaceAfterTag = rest.search(/\s/);
  const tagName = spaceAfterTag === -1 ? rest : rest.slice(0, spaceAfterTag).trim();
  const propStr = spaceAfterTag === -1 ? '' : rest.slice(spaceAfterTag).trim();

  const el = document.createElement(tagName);
  el.id = 'lunex-' + elName;

  // Fix iOS button default appearance
  if (tagName === 'button' || tagName === 'input') {
    el.style.webkitAppearance = 'none';
    el.style.appearance = 'none';
  }

  // Parse key="value" pairs — FIX: check string FIRST to avoid dash/plus splitting
  const propRegex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = propRegex.exec(propStr)) !== null) {
    const key = match[1].trim();
    // ── FIX: use the raw string value directly, don't run through evaluate
    // evaluate() had a bug where it would split strings containing - / + before
    // checking if the value was a quoted string. Raw assignment is correct here.
    const val = match[2];

    if      (key === 'text')        el.textContent = val;
    else if (key === 'html')        el.innerHTML = val;
    else if (key === 'placeholder') el.placeholder = val;
    else if (key === 'value')       el.value = val;
    else if (key === 'src')         el.src = val;
    else if (key === 'href')        el.href = val;
    else if (key === 'type')        el.type = val;
    else if (key === 'class')       el.className = val;
    else if (key === 'id')          el.id = val;
    else                            el.style[key] = val;
  }

  elements[elName] = el;
  vars[elName] = elName;
}

// place el. or place el inside parent.
else if (line.startsWith('place ')) {
  const raw = line.slice(6).replace(/\.$/, '').trim();

  if (raw.includes(' inside ')) {
    const parts = raw.split(' inside ');
    const elName = parts[0].trim();
    const parentName = parts[1].trim();
    const el = elements[elName];
    const parent = parentName === 'page'
      ? getAppRoot()
      : (elements[parentName] || document.getElementById(parentName) || document.getElementById('lunex-' + parentName));
    if (!el)     { console.error(`Lunex: "${elName}" not found`); return; }
    if (!parent) { console.error(`Lunex: parent "${parentName}" not found`); return; }
    parent.appendChild(el);
  } else {
    const elName = raw.trim();
    const el = elements[elName];
    if (!el) { console.error(`Lunex: "${elName}" not found`); return; }
    getAppRoot().appendChild(el);
  }
}

// row elName prop="val".
else if (line.startsWith('row ')) {
  const raw = line.slice(4).replace(/\.$/, '').trim();
  const spaceIdx = raw.search(/\s/);
  const elName = spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
  const propStr = spaceIdx === -1 ? '' : raw.slice(spaceIdx).trim();
  const el = document.createElement('div');
  el.id = 'lunex-' + elName;
  el.style.display = 'flex';
  el.style.flexDirection = 'row';
  el.style.alignItems = 'center';
  const propRegex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = propRegex.exec(propStr)) !== null) {
    el.style[match[1]] = match[2];
  }
  // Safari prefix for backdrop-filter
  if (propStr.includes('backdropFilter')) {
    el.style.webkitBackdropFilter = el.style.backdropFilter;
  }
  elements[elName] = el;
  vars[elName] = elName;
}

// col elName prop="val".
else if (line.startsWith('col ')) {
  const raw = line.slice(4).replace(/\.$/, '').trim();
  const spaceIdx = raw.search(/\s/);
  const elName = spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
  const propStr = spaceIdx === -1 ? '' : raw.slice(spaceIdx).trim();
  const el = document.createElement('div');
  el.id = 'lunex-' + elName;
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  const propRegex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = propRegex.exec(propStr)) !== null) {
    el.style[match[1]] = match[2];
  }
  // Safari prefix for backdrop-filter
  if (propStr.includes('backdropFilter')) {
    el.style.webkitBackdropFilter = el.style.backdropFilter;
  }
  elements[elName] = el;
  vars[elName] = elName;
}

// show / hide
else if (line.startsWith('show ')) {
  const elName = line.slice(5).replace(/\.$/, '').trim();
  const el = elements[elName];
  if (el) el.style.display = el._prevDisplay || 'block';
}
else if (line.startsWith('hide ')) {
  const elName = line.slice(5).replace(/\.$/, '').trim();
  const el = elements[elName];
  if (el) { el._prevDisplay = el.style.display; el.style.display = 'none'; }
}

// on el click: action.
else if (line.startsWith('on ')) {
  const raw = line.slice(3).replace(/\.$/, '').trim();
  const colonIndex = raw.indexOf(':');
  if (colonIndex === -1) { console.error(`Lunex: missing : in "${line}"`); return; }
  const trigger = raw.slice(0, colonIndex).trim();
  const action = raw.slice(colonIndex + 1).trim();
  const parts = trigger.split(' ');
  const elName = parts[0].trim();
  const event = parts[1]?.trim() || 'click';
  const el = elements[elName];
  if (!el) { console.error(`Lunex: element "${elName}" not found`); return; }
  const snapVars = vars;
  const snapFuncs = funcs;
  el.addEventListener(event, () => { runLine(action, snapVars, snapFuncs); });
}

// change el to "value".
else if (line.startsWith('change ')) {
  const raw = line.slice(7).replace(/\.$/, '').trim();
  const toIndex = raw.indexOf(' to ');
  if (toIndex === -1) { console.error(`Lunex: missing "to" in "${line}"`); return; }
  const elName = raw.slice(0, toIndex).trim();
  const newVal = evaluate(raw.slice(toIndex + 4).trim(), vars);
  const el = elements[elName] || document.getElementById('lunex-' + elName);
  if (!el) { console.error(`Lunex: element "${elName}" not found`); return; }
  el.textContent = String(newVal);
}

// get el value as varName.
else if (line.startsWith('get ')) {
  const raw = line.slice(4).replace(/\.$/, '').trim();
  const asIndex = raw.indexOf(' as ');
  if (asIndex === -1) { console.error(`Lunex: missing "as" in "${line}"`); return; }
  const elName = raw.slice(0, asIndex).trim();
  const varName = raw.slice(asIndex + 4).trim();
  const el = elements[elName];
  if (!el) { console.error(`Lunex: element "${elName}" not found`); return; }
  const val = el.value || el.textContent;
  vars[varName] = isNaN(val) ? val : Number(val);
}

// function call: greet.
else if (funcs[line.replace(/\.$/, '').trim()]) {
  await runFunction(line.replace(/\.$/, '').trim(), {}, vars, funcs);
}

// function call with args: greet with name = "Roland".
else if (line.includes(' with ') && funcs[line.split(' with ')[0].trim()]) {
  const parts = line.split(' with ');
  const funcName = parts[0].trim();
  const argsPart = parts[1].replace(/\.$/, '').trim();
  const localVars = { ...vars };
  argsPart.split(',').forEach(arg => {
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      localVars[arg.slice(0, eq).trim()] = evaluate(arg.slice(eq + 1).trim(), vars);
    }
  });
  await runFunction(funcName, localVars, vars, funcs);
}

else {
  if (line && !line.startsWith('end')) {
    console.warn(`Lunex: unknown command "${line.slice(0, 40)}"`);
  }
}
```

}

// ── Run a function ───────────────────────
async function runFunction(funcName, localVars, vars, funcs) {
const body = funcs[funcName];
if (!body) { console.error(`Lunex: "${funcName}" not found`); return; }
const scope = { …vars, …localVars, **return**: undefined };
for (const line of body) {
await runLine(line, scope, funcs);
if (scope[’**return**’] !== undefined) break;
}
if (scope[’**return**’] !== undefined) vars[‘result’] = scope[’**return**’];
}

// ── Condition evaluator ──────────────────
function evaluateCondition(condition, vars) {
const operators = [’>=’, ‘<=’, ‘!=’, ‘>’, ‘<’, ‘=’];
for (const op of operators) {
const idx = condition.indexOf(op);
if (idx === -1) continue;
const left = evaluate(condition.slice(0, idx).trim(), vars);
const right = evaluate(condition.slice(idx + op.length).trim(), vars);
switch (op) {
case ‘>’:  return left > right;
case ‘<’:  return left < right;
case ‘>=’: return left >= right;
case ‘<=’: return left <= right;
case ‘!=’: return left != right;
case ‘=’:  return left == right;
}
}
return false;
}

// ── Expression evaluator ─────────────────
// FIX: check for quoted string FIRST before arithmetic splitting
function evaluate(expr, vars) {
expr = expr.trim();

```
// List literal
if (expr.startsWith('[') && expr.endsWith(']')) {
  return expr.slice(1, -1).split(',').map(i => evaluate(i.trim(), vars));
}

// ── FIX: quoted string MUST be checked before arithmetic operators ──
// The old order (check + - * / before quotes) caused strings like
// "space-between", "rgba(0,0,0,0.5)", "-2px" to be split incorrectly.
if (expr.startsWith('"') && expr.endsWith('"') && expr.length > 1) {
  return expr.slice(1, -1);
}
if (expr.startsWith("'") && expr.endsWith("'") && expr.length > 1) {
  return expr.slice(1, -1);
}

// Number
if (!isNaN(expr) && expr !== '') return Number(expr);

// Variable lookup
if (Object.prototype.hasOwnProperty.call(vars, expr)) return vars[expr];

// Arithmetic — only for non-string expressions
if (expr.includes('+')) {
  const parts = expr.split('+').map(p => evaluate(p.trim(), vars));
  return parts.every(p => typeof p === 'number') ? parts.reduce((a, b) => a + b, 0) : parts.join('');
}
if (expr.includes('*')) {
  const parts = expr.split('*').map(p => evaluate(p.trim(), vars));
  if (parts.every(p => typeof p === 'number')) return parts.reduce((a, b) => a * b, 1);
}
if (expr.includes('-') && !/^-?\d/.test(expr)) {
  // Only split on - if it's not a negative number
  const parts = expr.split('-').map(p => evaluate(p.trim(), vars));
  if (parts.every(p => typeof p === 'number')) return parts.reduce((a, b) => a - b);
}
if (expr.includes('/')) {
  const parts = expr.split('/').map(p => evaluate(p.trim(), vars));
  if (parts.every(p => typeof p === 'number')) return parts.reduce((a, b) => a / b);
}

// Return as-is (could be a CSS value like "auto", "none", etc.)
return expr;
```

}

// ── Auto-run all <script type="text/lunex"> tags ──
window.addEventListener(‘DOMContentLoaded’, () => {
const scripts = document.querySelectorAll(‘script[type=“text/lunex”]’);
scripts.forEach(script => {
lunex(script.textContent).catch(err => {
console.error(’[Lunex runtime error]’, err);
});
});
});

window.lunex = lunex;

})();
