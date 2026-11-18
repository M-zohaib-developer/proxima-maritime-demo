// Zero-dependency test setup: resolves the "@/..." path alias to ./src so the
// app's TypeScript service modules can be imported directly by `node --test`
// (Node strips TypeScript types natively).
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      const base = path.join(src, specifier.slice(2));
      for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
        if (existsSync(c) && !c.endsWith(path.sep) && path.extname(c)) return next(pathToFileURL(c).href, context);
      }
    }
    return next(specifier, context);
  },
});
