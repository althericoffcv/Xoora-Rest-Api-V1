/* A tiny syntax highlighter (JSON, JavaScript, Python, shell) — about 100 lines
   instead of a 30 KB+ library. Output is built with DOM nodes, never innerHTML. */

import { h } from './dom.js';

const KEYWORDS = {
  js: new Set(['const', 'let', 'var', 'await', 'async', 'import', 'from', 'export', 'return', 'new', 'function', 'if', 'else', 'for', 'of', 'in', 'throw', 'try', 'catch', 'class', 'default', 'typeof']),
  python: new Set(['import', 'from', 'as', 'def', 'return', 'with', 'for', 'in', 'if', 'else', 'elif', 'raise', 'try', 'except', 'class', 'lambda', 'await', 'async', 'not', 'and', 'or']),
};

const STRINGS = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y;

const RULES = {
  json: [
    ['key', /"(?:[^"\\]|\\.)*"(?=\s*:)/y],
    ['str', /"(?:[^"\\]|\\.)*"/y],
    ['num', /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y],
    ['lit', /\b(?:true|false|null)\b/y],
    ['punc', /[{}[\],:]/y],
  ],
  js: [
    ['com', /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
    ['str', /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/y],
    ['num', /\b\d+(?:\.\d+)?\b/y],
    ['word', /[A-Za-z_$][\w$]*/y],
    ['punc', /[{}()[\];,.:=<>+\-*/!?&|]/y],
  ],
  python: [
    ['com', /#[^\n]*/y],
    ['str', STRINGS],
    ['num', /\b\d+(?:\.\d+)?\b/y],
    ['word', /[A-Za-z_][\w]*/y],
    ['punc', /[{}()[\];,.:=<>+\-*/!?&|]/y],
  ],
  bash: [
    ['com', /#[^\n]*/y],
    ['str', /"(?:[^"\\]|\\.)*"|'[^']*'/y],
    ['flag', /--?[A-Za-z][\w-]*/y],
    ['word', /[A-Za-z_][\w.-]*/y],
    ['punc', /\\|[|&;<>]/y],
  ],
};

function classify(word, code, end, lang) {
  if (lang === 'bash') return word === 'curl' ? 'fn' : 'plain';
  if (KEYWORDS[lang].has(word)) return 'kw';
  if (/^(?:true|false|null|undefined|None|True|False)$/.test(word)) return 'lit';
  return /^\s*\(/.test(code.slice(end, end + 6)) ? 'fn' : 'plain';
}

function tokenize(code, lang) {
  const rules = RULES[lang];
  if (!rules) return [{ type: 'plain', text: code }];
  const tokens = [];
  let plain = '';
  let i = 0;
  const flush = () => {
    if (plain) tokens.push({ type: 'plain', text: plain });
    plain = '';
  };
  while (i < code.length) {
    let hit = null;
    for (const [type, re] of rules) {
      re.lastIndex = i;
      const match = re.exec(code);
      if (match && match[0].length) {
        hit = { type, text: match[0] };
        break;
      }
    }
    if (!hit) {
      plain += code[i++];
      continue;
    }
    flush();
    const type = hit.type === 'word' ? classify(hit.text, code, i + hit.text.length, lang) : hit.type;
    if (type === 'plain') plain += hit.text;
    else tokens.push({ type, text: hit.text });
    i += hit.text.length;
  }
  flush();
  return tokens;
}

function toLines(tokens) {
  const lines = [[]];
  for (const token of tokens) {
    token.text.split('\n').forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ type: token.type, text: part });
    });
  }
  return lines;
}

/** Returns one <span class="line"> per source line. */
export function highlightLines(code, lang = 'text') {
  return toLines(tokenize(String(code), lang)).map((line) =>
    h(
      'span',
      { class: 'line' },
      line.map((token) => (token.type === 'plain' ? token.text : h('span', { class: `tok-${token.type}` }, token.text)))
    )
  );
}
