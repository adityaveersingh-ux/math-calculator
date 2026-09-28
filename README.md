# Math Calculator

A scientific calculator that runs in the browser, built with plain HTML, CSS and JavaScript.

**Live:** https://math-calculator-navy.vercel.app

## Features

- `+ − × ÷`, powers (`^`), brackets, with correct operator precedence
- `sin`, `cos`, `tan` and their inverses, with a DEG/RAD toggle
- `√`, `ln`, `log`, `n!`, `%`, `π`, `e`, and `Ans` for the last answer
- Implicit multiplication (`2π`, `3(4)`)
- Live result preview, clickable history, light/dark theme
- Keyboard support: Enter to evaluate, Esc to clear, Backspace to delete

Expressions are evaluated with a small recursive-descent parser in `script.js`, not `eval`.

## Run locally

Open `index.html` in a browser. There is no build step.

## Deploy

```
vercel --prod
```
