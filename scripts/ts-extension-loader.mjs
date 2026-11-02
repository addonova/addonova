import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const extensionEquivalents = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

function resolveTypeScriptEquivalent(specifier, parentUrl) {
  if (typeof parentUrl !== 'string' || !parentUrl.startsWith('file:')) {
    return undefined;
  }
  if (!specifier.startsWith('.') && !specifier.startsWith('file:')) {
    return undefined;
  }

  const target = specifier.startsWith('file:')
    ? fileURLToPath(specifier)
    : path.resolve(path.dirname(fileURLToPath(parentUrl)), specifier);
  const extname = path.extname(target);
  const equivalents = extensionEquivalents[extname];
  if (equivalents === undefined || existsSync(target)) {
    return undefined;
  }

  const base = target.slice(0, target.length - extname.length);
  for (const equivalent of equivalents) {
    const candidate = `${base}${equivalent}`;
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolved = resolveTypeScriptEquivalent(specifier, context.parentURL);
    if (resolved !== undefined) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
