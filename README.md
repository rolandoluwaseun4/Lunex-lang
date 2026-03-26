# Lunex

A programming language in plain English.

```
make name = "Roland".
dsp "Hello, " + name + "!".
```

Output:
```
Hello, Roland!
```

---

## Install

```bash
npm install -g lunex-lang
```

Then run any `.lnx` file:

```bash
lunex myfile.lnx
```

Or without installing globally:

```bash
node lunex.js myfile.lnx
```

---

## Commands

### `make` — Create a variable

```
make name = "Roland".
make age = 20.
make scores = [85, 92, 78].
```

### `dsp` — Display output

```
dsp "Hello World".
dsp name.
dsp "My name is " + name + " and I am " + age + " years old.".
```

### `if` — Condition

```
if age >= 18: dsp "Adult". otherwise: dsp "Minor".
```

Operators: `>`, `<`, `>=`, `<=`, `=`, `!=`

### `loop` — Repeat code

**Loop N times:**
```
loop 5 times: dsp "Hello".
```

**Loop through a list:**
```
make fruits = ["mango", "banana", "pawpaw"].
loop through fruits: dsp index + ". " + item.
```

Inside loops, `item` holds the current value and `index` holds the position (starting from 1).

### `assign` — Define a function

```
assign greet:
  dsp "Hello, " + name + "!".
end.

greet with name = "Roland".
```

### `rev` — Return a value from a function

```
assign double:
  rev num times 2.
end.

double with num = 7.
dsp "Result: " + result.
```

The returned value is available as `result` after calling the function.

### `store` — Get input from user

```
store name ask "What is your name?".
dsp "Hello, " + name + "!".
```

---

## English Math

Lunex supports math in plain English words:

| Word | Meaning | Symbol |
|------|---------|--------|
| `plus` | addition | `+` |
| `minus` | subtraction | `-` |
| `times` | multiplication | `*` |
| `divided by` | division | `/` |
| `modulo` | remainder | `%` |

```
make price = 100.
make tax = 20.
make total = price plus tax.
dsp "Total: " + total.

make area = 8 times 5.
dsp "Area: " + area.

make share = total divided by 4.
dsp "Each pays: " + share.
```

Output:
```
Total: 120
Area: 40
Each pays: 30
```

---

## Full Example

```
// Grade calculator

assign grade:
  if score >= 90: rev "A".
  if score >= 80: rev "B".
  if score >= 70: rev "C".
  if score >= 60: rev "D".
  otherwise: rev "F".
end.

make students = ["Roland", "Luna", "John"].
make scores   = [85, 42, 71].

grade with score = 85.
dsp "Roland: " + result.

grade with score = 42.
dsp "Luna: " + result.

grade with score = 71.
dsp "John: " + result.
```

Output:
```
Roland: B
Luna: F
John: C
```

---

## Error Messages

Lunex gives you helpful error messages with suggestions:

```
Lunex Error on line 3:
  make x 10.
  → Missing "=" in variable declaration. Did you mean: make x = 10.?
```

```
Lunex Error on line 1:
  print "Hello".
  → Unknown command "print". Did you mean: dsp "Hello".?
```

---

## CLI Options

```bash
lunex myfile.lnx      # Run a file
lunex --version       # Show version
lunex --help          # Show help
```

---

## Try it in the Browser

Visit the live playground: **[rolandoluwaseun4.github.io/Lunex-lang](https://rolandoluwaseun4.github.io/Lunex-lang/)**

Write Lunex code and run it instantly without installing anything.

---

## About

Lunex was designed and built by **Oluwaseun Roland** from Nigeria.  
Built from scratch on a mobile phone.

- GitHub: [github.com/rolandoluwaseun4](https://github.com/rolandoluwaseun4)
- X: [@roze_mpire](https://x.com/roze_mpire)

---

## License

MIT
