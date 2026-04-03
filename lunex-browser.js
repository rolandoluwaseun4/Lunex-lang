// ─────────────────────────────────────────
//  Lunex Browser Runtime v0.7
//  Include this in any HTML page then write:
//  <script type="text/lunex"> ... </script>
// ─────────────────────────────────────────

(function() {

  // ── Output target ───────────────────────
  // dsp writes to #lunex-output if it exists, otherwise console
  // Web commands write to #lunex-app if it exists, otherwise body
  function output(val) {
    const el = document.getElementById('lunex-output');
    if (el) {
      const line = document.createElement('div');
      line.textContent = val;
      el.appendChild(line);
    } else {
      console.log('[Lunex]', val);
    }
  }

  function getAppRoot() {
    return document.getElementById('lunex-app') || document.body;
  }

  // Element registry — maps Lunex names to DOM elements
  const elements = {};

  // ── Main interpreter ─────────────────────
  async function lunex(code) {
    const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
    const vars  = {};
    const funcs = {};

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
  }

  // ── Run a single line ────────────────────
  async function runLine(line, vars, funcs) {
    line = line.trim();

    // dsp
    if (line.startsWith('dsp ')) {
      const raw = line.slice(4).replace(/\.$/, '').trim();
      output(evaluate(raw, vars));
    }

    // make
    else if (line.startsWith('make ')) {
      const raw = line.slice(5).replace(/\.$/, '').trim();
      const eqIndex = raw.indexOf('=');
      if (eqIndex === -1) { console.error(`Lunex error: missing = in "${line}"`); return; }
      vars[raw.slice(0, eqIndex).trim()] = evaluate(raw.slice(eqIndex + 1).trim(), vars);
    }

    // store — uses browser prompt()
    else if (line.startsWith('store ')) {
      const raw = line.replace(/\.$/, '').slice(6).trim();
      const askIndex = raw.indexOf(' ask ');
      if (askIndex === -1) { console.error(`Lunex error: missing ask in "${line}"`); return; }
      const varName = raw.slice(0, askIndex).trim();
      const question = raw.slice(askIndex + 5).trim().replace(/^"|"$/g, '');
      const answer = window.prompt(question);
      vars[varName] = isNaN(answer) ? answer : Number(answer);
    }

    // if
    else if (line.startsWith('if ')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) { console.error(`Lunex error: missing : in "${line}"`); return; }
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
      if (colonIndex === -1) { console.error(`Lunex error: missing : in "${line}"`); return; }
      const loopDef  = line.slice(5, colonIndex).trim();
      const loopBody = line.slice(colonIndex + 1).trim();

      if (loopDef.endsWith('times')) {
        const count = Number(evaluate(loopDef.slice(0, loopDef.lastIndexOf('times')).trim(), vars));
        for (let i = 0; i < count; i++) {
          vars['index'] = i + 1;
          await runLine(loopBody, vars, funcs);
        }
      } else if (loopDef.startsWith('through ')) {
        const list = vars[loopDef.slice(8).trim()];
        if (!Array.isArray(list)) { console.error(`Lunex error: not a list`); return; }
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

    // NEW all-in-one create:
    // create title as h1 text="Hello" color="white" fontSize="36px".
    // create btn as button text="Click me" background="#7c3aed" padding="12px".
    // create box as div background="#141414" borderRadius="16px" padding="24px".
    else if (line.startsWith('create ')) {
      const raw = line.slice(7).replace(/\.$/, '').trim();
      const asIndex = raw.indexOf(' as ');
      if (asIndex === -1) { console.error(`Lunex error: missing "as" in "${line}"`); return; }

      const elName  = raw.slice(0, asIndex).trim();
      const rest    = raw.slice(asIndex + 4).trim();

      // tag is first word after "as"
      const spaceAfterTag = rest.search(/\s/);
      const tagName = spaceAfterTag === -1 ? rest : rest.slice(0, spaceAfterTag).trim();
      const propStr = spaceAfterTag === -1 ? '' : rest.slice(spaceAfterTag).trim();

      const el = document.createElement(tagName);
      el.id = 'lunex-' + elName;

      // Parse key=value pairs — handles quoted values with spaces
      const propRegex = /(\w+)="([^"]*)"/g;
      let match;
      while ((match = propRegex.exec(propStr)) !== null) {
        const key = match[1].trim();
        const val = evaluate('"' + match[2] + '"', vars);

        // Content props
        if (key === 'text')        el.textContent = val;
        else if (key === 'html')   el.innerHTML = val;
        else if (key === 'placeholder') el.placeholder = val;
        else if (key === 'value')  el.value = val;
        else if (key === 'src')    el.src = val;
        else if (key === 'href')   el.href = val;
        else if (key === 'type')   el.type = val;
        else if (key === 'class')  el.className = val;
        // Everything else is a CSS style
        else el.style[key] = val;
      }

      // Also handle unquoted number values like fontSize=32
      const numRegex = /(\w+)=(\d+(?:\.\d+)?(?:px|em|rem|vh|vw|%)?)\b/g;
      while ((match = numRegex.exec(propStr)) !== null) {
        const key = match[1];
        const val = match[2];
        // Skip if already handled by quoted regex
        if (!propStr.includes(`${key}="`)) {
          el.style[key] = val.match(/^\d+$/) ? val + 'px' : val;
        }
      }

      elements[elName] = el;
      vars[elName] = elName;
    }

    // place — put element on page or inside another element
    //
    // place card.                    → puts card on page
    // place title inside card.       → puts title inside card
    // place card inside row.         → nesting
    // place card inside page.        → explicit page root
    else if (line.startsWith('place ')) {
      const raw = line.slice(6).replace(/\.$/, '').trim();

      if (raw.includes(' inside ')) {
        const parts    = raw.split(' inside ');
        const elName   = parts[0].trim();
        const parentName = parts[1].trim();
        const el = elements[elName];
        const parent = parentName === 'page'
          ? getAppRoot()
          : (elements[parentName] || document.getElementById(parentName) || document.getElementById('lunex-' + parentName));
        if (!el)     { console.error(`Lunex error: "${elName}" not found`); return; }
        if (!parent) { console.error(`Lunex error: parent "${parentName}" not found`); return; }
        parent.appendChild(el);
      } else {
        const elName = raw.trim();
        const el = elements[elName];
        if (!el) { console.error(`Lunex error: "${elName}" not found`); return; }
        getAppRoot().appendChild(el);
      }
    }

    // row — create a horizontal flex container
    // row myRow.
    else if (line.startsWith('row ')) {
      const raw = line.slice(4).replace(/\.$/, '').trim();
      // parse name and optional props: row navbar gap="16px" padding="20px".
      const spaceIdx = raw.search(/\s/);
      const elName = spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
      const propStr = spaceIdx === -1 ? '' : raw.slice(spaceIdx).trim();
      const el = document.createElement('div');
      el.id = 'lunex-' + elName;
      el.style.display = 'flex';
      el.style.flexDirection = 'row';
      el.style.alignItems = 'center';
      // parse extra props
      const propRegex = /(\w+)="([^"]*)"/g;
      let match;
      while ((match = propRegex.exec(propStr)) !== null) {
        el.style[match[1]] = match[2];
      }
      elements[elName] = el;
      vars[elName] = elName;
    }

    // col — create a vertical flex container
    // col sidebar.
    else if (line.startsWith('col ')) {
      const raw = line.slice(4).replace(/\.$/, '').trim();
      const spaceIdx = raw.search(/\s/);
      const elName = spaceIdx === -1 ? raw : raw.slice(0, spaceIdx);
      const propStr = spaceIdx === -1 ? '' : raw.slice(spaceIdx).trim();
      const el = document.createElement('div');
      el.id = 'lunex-' + elName;
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      const propRegex = /(\w+)=["“]([^"”]*)["”]/g;
      let match;
      while ((match = propRegex.exec(propStr)) !== null) {
        el.style[match[1]] = match[2];
      }
      elements[elName] = el;
      vars[elName] = elName;
    }

    // show element.  hide element.
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

    // on btn click: change heading to "You clicked it!".
    // on btn click: dsp "clicked".
    else if (line.startsWith('on ')) {
      const raw = line.slice(3).replace(/\.$/, '').trim();
      const colonIndex = raw.indexOf(':');
      if (colonIndex === -1) { console.error(`Lunex error: missing : in "${line}"`); return; }
      const trigger = raw.slice(0, colonIndex).trim();  // e.g. "btn click"
      const action  = raw.slice(colonIndex + 1).trim(); // e.g. "change heading to ..."
      const parts   = trigger.split(' ');
      const elName  = parts[0].trim();
      const event   = parts[1]?.trim() || 'click';
      const el = elements[elName];
      if (!el) { console.error(`Lunex error: element "${elName}" not found`); return; }
      // Capture current vars/funcs snapshot for closure
      const snapVars  = vars;
      const snapFuncs = funcs;
      el.addEventListener(event, () => {
        runLine(action, snapVars, snapFuncs);
      });
    }

    // change heading to "New text".
    // change heading to name.
    else if (line.startsWith('change ')) {
      const raw = line.slice(7).replace(/\.$/, '').trim();
      const toIndex = raw.indexOf(' to ');
      if (toIndex === -1) { console.error(`Lunex error: missing "to" in "${line}"`); return; }
      const elName = raw.slice(0, toIndex).trim();
      const newVal = evaluate(raw.slice(toIndex + 4).trim(), vars);
      const el = elements[elName] || document.getElementById('lunex-' + elName);
      if (!el) { console.error(`Lunex error: element "${elName}" not found`); return; }
      el.textContent = String(newVal);
    }

    // get input value as userInput.
    else if (line.startsWith('get ')) {
      const raw = line.slice(4).replace(/\.$/, '').trim();
      const asIndex = raw.indexOf(' as ');
      if (asIndex === -1) { console.error(`Lunex error: missing "as" in "${line}"`); return; }
      const elName  = raw.slice(0, asIndex).trim();
      const varName = raw.slice(asIndex + 4).trim();
      const el = elements[elName];
      if (!el) { console.error(`Lunex error: element "${elName}" not found`); return; }
      const val = el.value || el.textContent;
      vars[varName] = isNaN(val) ? val : Number(val);
    }

    // function call: greet.
    else if (funcs[line.replace(/\.$/, '').trim()]) {
      await runFunction(line.replace(/\.$/, '').trim(), {}, vars, funcs);
    }

    // function call with args: greet with name = "Roland".
    else if (line.includes(' with ') && funcs[line.split(' with ')[0].trim()]) {
      const parts    = line.split(' with ');
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
        console.error(`Lunex error: unknown command in "${line}"`);
      }
    }
  }

  // ── Run a function ───────────────────────
  async function runFunction(funcName, localVars, vars, funcs) {
    const body = funcs[funcName];
    if (!body) { console.error(`Lunex error: "${funcName}" not found`); return; }
    const scope = { ...vars, ...localVars, __return__: undefined };
    for (const line of body) {
      await runLine(line, scope, funcs);
      if (scope['__return__'] !== undefined) break;
    }
    if (scope['__return__'] !== undefined) vars['result'] = scope['__return__'];
  }

  // ── Condition evaluator ──────────────────
  function evaluateCondition(condition, vars) {
    const operators = ['>=', '<=', '!=', '>', '<', '='];
    for (const op of operators) {
      const idx = condition.indexOf(op);
      if (idx === -1) continue;
      const left  = evaluate(condition.slice(0, idx).trim(), vars);
      const right = evaluate(condition.slice(idx + op.length).trim(), vars);
      switch (op) {
        case '>':  return left > right;
        case '<':  return left < right;
        case '>=': return left >= right;
        case '<=': return left <= right;
        case '!=': return left != right;
        case '=':  return left == right;
      }
    }
    return false;
  }

  // ── Expression evaluator ─────────────────
  function evaluate(expr, vars) {
    expr = expr.trim();

    if (expr.startsWith('[') && expr.endsWith(']')) {
      return expr.slice(1, -1).split(',').map(i => evaluate(i.trim(), vars));
    }
    if (expr.includes('+')) {
      const parts = expr.split('+').map(p => evaluate(p.trim(), vars));
      return parts.every(p => typeof p === 'number') ? parts.reduce((a,b) => a+b, 0) : parts.join('');
    }
    if (expr.includes('*')) {
      const parts = expr.split('*').map(p => evaluate(p.trim(), vars));
      if (parts.every(p => typeof p === 'number')) return parts.reduce((a,b) => a*b, 1);
    }
    if (expr.includes('-')) {
      const parts = expr.split('-').map(p => evaluate(p.trim(), vars));
      if (parts.every(p => typeof p === 'number')) return parts.reduce((a,b) => a-b);
    }
    if (expr.includes('/')) {
      const parts = expr.split('/').map(p => evaluate(p.trim(), vars));
      if (parts.every(p => typeof p === 'number')) return parts.reduce((a,b) => a/b);
    }
    if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);
    if (!isNaN(expr) && expr !== '') return Number(expr);
    if (vars.hasOwnProperty(expr)) return vars[expr];

    console.error(`Lunex error: unknown value "${expr}"`);
    return undefined;
  }

  // ── Auto-run all <script type="text/lunex"> tags ──
  window.addEventListener('DOMContentLoaded', () => {
    const scripts = document.querySelectorAll('script[type="text/lunex"]');
    scripts.forEach(script => lunex(script.textContent));
  });

  // Expose globally
  window.lunex = lunex;

})();
