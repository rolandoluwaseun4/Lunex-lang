#!/usr/bin/env node
// ─────────────────────────────────────────
//  Lunex Interpreter v1.0.0
//  A programming language in plain English
//  github.com/rolandoluwaseun4/lunex-lang
// ─────────────────────────────────────────

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const VERSION = '1.0.0';

// ── Input buffer ─────────────────────────
const inputLines    = [];
let   inputResolvers = [];
let   inputBuffer   = '';
let   lineNumber    = 0; // track current line for errors

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  inputBuffer += chunk;
  const lines = inputBuffer.split('\n');
  inputBuffer = lines.pop();
  for (const line of lines) {
    if (inputResolvers.length > 0) inputResolvers.shift()(line.trim());
    else inputLines.push(line.trim());
  }
});
process.stdin.on('end', () => {
  if (inputBuffer.trim()) {
    if (inputResolvers.length > 0) inputResolvers.shift()(inputBuffer.trim());
    else inputLines.push(inputBuffer.trim());
  }
  while (inputResolvers.length > 0) inputResolvers.shift()('');
});

// ── Error reporter ───────────────────────
function lunexError(msg, line, raw) {
  console.error(`\n  Lunex Error on line ${line}:`);
  console.error(`  ${raw}`);
  console.error(`  → ${msg}\n`);
}

function lunexWarning(msg, line) {
  console.warn(`  Warning (line ${line}): ${msg}`);
}

// ── Main interpreter ─────────────────────
async function lunex(code) {
  const rawLines = code.split('\n');
  const lines    = rawLines
    .map((l, i) => ({ text: l.trim(), num: i + 1 }))
    .filter(l => l.text && !l.text.startsWith('//'));

  const vars  = {};
  const funcs = {};

  // First pass — collect functions
  let i = 0;
  while (i < lines.length) {
    const { text, num } = lines[i];
    if (text.startsWith('assign ')) {
      const funcName = text.slice(7).replace(/:$/, '').trim();
      if (!funcName) {
        lunexError('Function name missing after "assign"', num, text);
        i++; continue;
      }
      const body = [];
      i++;
      while (i < lines.length && !lines[i].text.startsWith('end')) {
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
    const { text, num } = lines[i];
    if (text.startsWith('assign ')) {
      i++;
      while (i < lines.length && !lines[i].text.startsWith('end')) i++;
      i++; continue;
    }
    await runLine(text, num, vars, funcs);
    i++;
  }
}

// ── Run single line ──────────────────────
async function runLine(line, num, vars, funcs) {
  line = line.trim();

  // ── dsp ──────────────────────────────
  if (line.startsWith('dsp ')) {
    const raw = line.slice(4).replace(/\.$/, '').trim();
    const val = evaluate(raw, vars, num, line);
    if (val !== undefined) console.log(val);
  }

  // ── make ─────────────────────────────
  else if (line.startsWith('make ')) {
    const raw     = line.slice(5).replace(/\.$/, '').trim();
    const eqIndex = raw.indexOf('=');
    if (eqIndex === -1) {
      lunexError(
        `Missing "=" in variable declaration. Did you mean: make ${raw} = "value".?`,
        num, line
      );
      return;
    }
    const varName = raw.slice(0, eqIndex).trim();
    const varVal  = raw.slice(eqIndex + 1).trim();
    if (!varName) {
      lunexError('Variable name missing after "make"', num, line);
      return;
    }
    if (!varVal) {
      lunexError(`Missing value after "=" for variable "${varName}"`, num, line);
      return;
    }
    vars[varName] = evaluate(varVal, vars, num, line);
  }

  // ── store ─────────────────────────────
  else if (line.startsWith('store ')) {
    const raw      = line.replace(/\.$/, '').slice(6).trim();
    const askIndex = raw.indexOf(' ask ');
    if (askIndex === -1) {
      lunexError(
        `Missing "ask" keyword. Did you mean: store ${raw} ask "Your question?".?`,
        num, line
      );
      return;
    }
    const varName  = raw.slice(0, askIndex).trim();
    const question = raw.slice(askIndex + 5).trim().replace(/^"|"$/g, '');
    const answer   = await askUser(question);
    vars[varName]  = isNaN(answer) || answer === '' ? answer : Number(answer);
  }

  // ── if ───────────────────────────────
  else if (line.startsWith('if ')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      lunexError(
        `Missing ":" after condition. Did you mean: if ${line.slice(3)} : dsp "result".?`,
        num, line
      );
      return;
    }
    const condPart = line.slice(3, colonIndex).trim();
    const rest     = line.slice(colonIndex + 1).trim();
    const owIdx    = rest.toLowerCase().indexOf('otherwise:');
    let thenPart   = rest, elsePart = null;
    if (owIdx !== -1) {
      thenPart = rest.slice(0, owIdx).trim();
      elsePart = rest.slice(owIdx + 10).trim();
    }
    const result = evaluateCondition(condPart, vars, num, line);
    if (result === null) return;
    if (result) await runLine(thenPart, num, vars, funcs);
    else if (elsePart) await runLine(elsePart, num, vars, funcs);
  }

  // ── loop ─────────────────────────────
  else if (line.startsWith('loop ')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      lunexError(`Missing ":" in loop. Did you mean: loop 5 times: dsp "hello".?`, num, line);
      return;
    }
    const loopDef  = line.slice(5, colonIndex).trim();
    const loopBody = line.slice(colonIndex + 1).trim();

    // loop X times
    if (loopDef.endsWith('times')) {
      const countExpr = loopDef.slice(0, loopDef.lastIndexOf('times')).trim();
      const count     = Number(evaluate(countExpr, vars, num, line));
      if (isNaN(count)) {
        lunexError(`"${countExpr}" is not a valid number for loop count`, num, line);
        return;
      }
      for (let k = 0; k < count; k++) {
        vars['index'] = k + 1;
        await runLine(loopBody, num, vars, funcs);
      }
    }

    // loop through list
    else if (loopDef.startsWith('through ')) {
      const listName = loopDef.slice(8).trim();
      const list     = vars[listName];
      if (!Array.isArray(list)) {
        lunexError(
          `"${listName}" is not a list. Make sure you declared it as: make ${listName} = ["a", "b", "c"].`,
          num, line
        );
        return;
      }
      for (let k = 0; k < list.length; k++) {
        vars['item']  = list[k];
        vars['index'] = k + 1;
        await runLine(loopBody, num, vars, funcs);
      }
    }

    else {
      lunexError(
        `Unknown loop type "${loopDef}". Use "loop 5 times" or "loop through myList".`,
        num, line
      );
    }
  }

  // ── rev ──────────────────────────────
  else if (line.startsWith('rev ')) {
    const raw = line.slice(4).replace(/\.$/, '').trim();
    vars['__return__'] = evaluate(raw, vars, num, line);
  }

  // ── function call: name. ─────────────
  else if (funcs[line.replace(/\.$/, '').trim()]) {
    await runFunction(line.replace(/\.$/, '').trim(), {}, vars, funcs, num);
  }

  // ── function call with args: name with x = 1. ──
  else if (line.includes(' with ') && funcs[line.split(' with ')[0].trim()]) {
    const parts    = line.split(' with ');
    const funcName = parts[0].trim();
    const argsPart = parts[1].replace(/\.$/, '').trim();
    const localVars = { ...vars };
    argsPart.split(',').forEach(arg => {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        const k = arg.slice(0, eq).trim();
        const v = arg.slice(eq + 1).trim();
        localVars[k] = evaluate(v, vars, num, line);
      }
    });
    await runFunction(funcName, localVars, vars, funcs, num);
  }

  else {
    if (line && !line.startsWith('end')) {
      // Smart suggestions
      const trimmed = line.replace(/\.$/, '').trim();
      let suggestion = '';
      if (trimmed.startsWith('print ') || trimmed.startsWith('log ') || trimmed.startsWith('echo '))
        suggestion = `Did you mean: dsp ${trimmed.split(' ').slice(1).join(' ')}.?`;
      else if (trimmed.startsWith('var ') || trimmed.startsWith('let ') || trimmed.startsWith('const '))
        suggestion = `Did you mean: make ${trimmed.split(' ').slice(1).join(' ')}.?`;
      else if (trimmed.startsWith('function ') || trimmed.startsWith('def ') || trimmed.startsWith('func '))
        suggestion = `Did you mean: assign ${trimmed.split(' ').slice(1).join(' ')}:?`;
      else if (trimmed.startsWith('return '))
        suggestion = `Did you mean: rev ${trimmed.slice(7)}.?`;
      else if (trimmed.startsWith('for ') || trimmed.startsWith('while ') || trimmed.startsWith('foreach '))
        suggestion = `Did you mean: loop through myList: ... or loop 5 times: ...?`;

      lunexError(
        `Unknown command "${trimmed}".${suggestion ? '\n  ' + suggestion : ''}\n  Commands: dsp, make, if, loop, assign, rev, store`,
        num, line
      );
    }
  }
}

// ── Run a function body ──────────────────
async function runFunction(funcName, localVars, vars, funcs, num) {
  const body = funcs[funcName];
  if (!body) {
    lunexError(`Function "${funcName}" is not defined. Did you forget to assign it first?`, num, '');
    return;
  }
  const scope = { ...vars, ...localVars, __return__: undefined };
  for (const { text, num: ln } of body) {
    await runLine(text, ln, scope, funcs);
    if (scope['__return__'] !== undefined) break;
  }
  if (scope['__return__'] !== undefined) vars['result'] = scope['__return__'];
}

// ── Condition evaluator ──────────────────
function evaluateCondition(condition, vars, num, raw) {
  const operators = ['>=', '<=', '!=', '>', '<', '='];
  for (const op of operators) {
    const idx = condition.indexOf(op);
    if (idx === -1) continue;
    const left  = evaluate(condition.slice(0, idx).trim(), vars, num, raw);
    const right = evaluate(condition.slice(idx + op.length).trim(), vars, num, raw);
    switch (op) {
      case '>':  return left > right;
      case '<':  return left < right;
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '!=': return left != right;
      case '=':  return left == right;
    }
  }
  lunexError(
    `Invalid condition "${condition}". Use operators: >, <, >=, <=, =, !=`,
    num, raw
  );
  return null;
}

// ── Expression evaluator ─────────────────
// Step 14 — English math words supported
function evaluate(expr, vars, num, raw) {
  expr = expr.trim().replace(/\.$/, '');

  // List literal
  if (expr.startsWith('[') && expr.endsWith(']')) {
    return expr.slice(1, -1).split(',').map(i => evaluate(i.trim(), vars, num, raw));
  }

  // ── English math words (Step 14) ────────────────
  // "price plus tax", "width times height", "total minus discount"
  const wordOps = [
    { word: ' plus ',     sym: '+' },
    { word: ' minus ',    sym: '-' },
    { word: ' times ',    sym: '*' },
    { word: ' divided by ', sym: '/' },
    { word: ' modulo ',   sym: '%' },
  ];
  for (const { word, sym } of wordOps) {
    const idx = expr.toLowerCase().indexOf(word);
    if (idx !== -1) {
      const left  = evaluate(expr.slice(0, idx).trim(), vars, num, raw);
      const right = evaluate(expr.slice(idx + word.length).trim(), vars, num, raw);
      if (typeof left === 'number' && typeof right === 'number') {
        if (sym === '+') return left + right;
        if (sym === '-') return left - right;
        if (sym === '*') return left * right;
        if (sym === '/') {
          if (right === 0) { lunexError('Cannot divide by zero', num, raw); return undefined; }
          return left / right;
        }
        if (sym === '%') return left % right;
      }
    }
  }

  // Symbol math & concatenation
  if (expr.includes('+')) {
    const parts = expr.split('+').map(p => evaluate(p.trim(), vars, num, raw));
    if (parts.every(p => typeof p === 'number')) return parts.reduce((a, b) => a + b, 0);
    return parts.map(p => (p === undefined ? '' : p)).join('');
  }
  if (expr.includes('*')) {
    const parts = expr.split('*').map(p => evaluate(p.trim(), vars, num, raw));
    if (parts.every(p => typeof p === 'number')) return parts.reduce((a, b) => a * b, 1);
  }
  if (expr.includes('-') && !/^-\d/.test(expr)) {
    const idx = expr.lastIndexOf('-');
    if (idx > 0) {
      const left  = evaluate(expr.slice(0, idx).trim(), vars, num, raw);
      const right = evaluate(expr.slice(idx + 1).trim(), vars, num, raw);
      if (typeof left === 'number' && typeof right === 'number') return left - right;
    }
  }
  if (expr.includes('/')) {
    const parts = expr.split('/').map(p => evaluate(p.trim(), vars, num, raw));
    if (parts.every(p => typeof p === 'number')) {
      if (parts[1] === 0) { lunexError('Cannot divide by zero', num, raw); return undefined; }
      return parts.reduce((a, b) => a / b);
    }
  }

  // String literal
  if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);

  // Boolean literals
  if (expr === 'true')  return true;
  if (expr === 'false') return false;

  // Number
  if (!isNaN(expr) && expr !== '') return Number(expr);

  // Variable
  if (vars.hasOwnProperty(expr)) return vars[expr];

  // Smart error
  lunexError(
    `"${expr}" is not defined. Did you forget to declare it with: make ${expr} = "value".?`,
    num, raw
  );
  return undefined;
}

// ── User input ───────────────────────────
function askUser(question) {
  process.stdout.write(question + ' ');
  return new Promise(resolve => {
    if (inputLines.length > 0) resolve(inputLines.shift());
    else inputResolvers.push(resolve);
  });
}

// ── CLI ──────────────────────────────────
const args = process.argv.slice(2);

// lunex --version
if (args[0] === '--version' || args[0] === '-v') {
  console.log(`Lunex v${VERSION}`);
  process.exit(0);
}

// lunex --help
if (args[0] === '--help' || args[0] === '-h' || args.length === 0) {
  console.log(`
  Lunex v${VERSION} — A programming language in plain English.

  Usage:
    node lunex.js <file.lnx>        Run a Lunex file
    node lunex.js --version         Show version
    node lunex.js --help            Show this help

  Commands:
    make name = "value".            Create a variable
    dsp "Hello, " + name.           Display output
    if age > 18: dsp "Adult".       Condition
    if x > 0: dsp "yes". otherwise: dsp "no".
    loop 5 times: dsp "Hello".      Repeat N times
    loop through list: dsp item.    Loop through list
    assign greet:                   Define a function
      dsp "Hello!".
    end.
    greet.                          Call a function
    greet with name = "Roland".     Call with arguments
    rev result.                     Return a value
    store name ask "Your name?".    Get user input

  English math:
    make total = price plus tax.
    make area  = width times height.
    make diff  = total minus discount.
    make share = total divided by 4.

  Example:
    make name = "Roland".
    dsp "Hello, " + name + "!".

  More: https://rolandoluwaseun4.github.io/Lunex-lang/
  `);
  process.exit(0);
}

// Run file
const filePath = path.resolve(args[0]);
if (!fs.existsSync(filePath)) {
  console.error(`\n  Lunex Error: File not found — "${filePath}"\n`);
  process.exit(1);
}
if (!filePath.endsWith('.lnx')) {
  console.error(`\n  Lunex Error: File must have .lnx extension. Rename your file to something.lnx\n`);
  process.exit(1);
}

const code = fs.readFileSync(filePath, 'utf8');
lunex(code).then(() => process.exit(0)).catch(err => {
  console.error(`\n  Lunex crashed: ${err.message}\n`);
  process.exit(1);
});
