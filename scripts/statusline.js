#!/usr/bin/env node
let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    process.stdout.write('');
    return;
  }

  const model = data.model?.display_name ?? 'unknown model';
  const pct = data.context_window?.used_percentage;
  const pctStr = typeof pct === 'number' ? `${Math.round(pct)}% context` : 'context: n/a';

  process.stdout.write(`${model} | ${pctStr}`);
});
