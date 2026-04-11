// Simple GLSL include preprocessor for browser usage.
// Supports lines like: #include "path/to/file.glsl" or #include <path/to/file.glsl>
// Also supports RayMarchBridge-style includes array (concatenated before main fragment).

async function fetchText(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  return await res.text();
}

function stripCarriageReturns(s) {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function resolveIncludeLine(line) {
  const m = line.match(/^\s*#include\s+["<]([^">]+)[">]\s*$/);
  return m ? m[1] : null;
}

async function preprocessGLSL(entrySource, options = {}) {
  const {
    basePath = '',
    cache = new Map(),
    includeStack = [],
    maxDepth = 64
  } = options;

  if (includeStack.length > maxDepth) {
    throw new Error('GLSL include maxDepth exceeded (possible cycle).');
  }

  const src = stripCarriageReturns(entrySource);
  const lines = src.split('\n');
  const out = [];

  for (const line of lines) {
    const inc = resolveIncludeLine(line);
    if (!inc) {
      out.push(line);
      continue;
    }

    const path = (basePath ? `${basePath.replace(/\/$/, '')}/` : '') + inc;
    if (includeStack.includes(path)) {
      throw new Error(`GLSL include cycle detected: ${[...includeStack, path].join(' -> ')}`);
    }

    let incText;
    if (cache.has(path)) {
      incText = cache.get(path);
    } else {
      incText = await fetchText(path);
      cache.set(path, incText);
    }

    // Determine nested basePath from include path
    const nextBasePath = path.split('/').slice(0, -1).join('/');
    const nested = await preprocessGLSL(incText, {
      basePath: nextBasePath,
      cache,
      includeStack: [...includeStack, path],
      maxDepth
    });

    out.push(`\n// ---- begin include: ${path} ----`);
    out.push(nested);
    out.push(`// ---- end include: ${path} ----\n`);
  }

  return out.join('\n');
}

window.GLSLPreprocess = {
  fetchText,
  preprocessGLSL
};
