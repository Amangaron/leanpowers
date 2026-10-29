import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULTS } from './defaults.mjs';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function typeMatches(value, type) {
  switch (type) {
    case 'object': return isPlainObject(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'integer': return Number.isInteger(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'boolean': return typeof value === 'boolean';
    default: return true;
  }
}

const join = (at, key) => (at ? `${at}.${key}` : key);

/**
 * Minimal JSON-schema validator. Supports: type, properties, additionalProperties,
 * required, enum, items, minimum. Returns messages of the form "<path>: <problem>".
 */
export function validate(value, schema, at = '') {
  if (schema.type && !typeMatches(value, schema.type)) return [`${at}: expected ${schema.type}`];
  const errors = [];
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${at}: must be one of ${schema.enum.join(', ')}`);
  }
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
    errors.push(`${at}: must be >= ${schema.minimum}`);
  }
  if (isPlainObject(value)) {
    const props = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${join(at, key)}: required`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key in props) errors.push(...validate(child, props[key], join(at, key)));
      else if (schema.additionalProperties === false) errors.push(`${join(at, key)}: unknown property`);
      else if (isPlainObject(schema.additionalProperties)) {
        errors.push(...validate(child, schema.additionalProperties, join(at, key)));
      }
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => errors.push(...validate(item, schema.items, `${at}[${i}]`)));
  }
  return errors;
}

/** Objects merge recursively; arrays and scalars from `override` replace. Returns a new object. */
export function deepMerge(base, override) {
  const out = { ...base };
  for (const [key, val] of Object.entries(override)) {
    out[key] = isPlainObject(val) && isPlainObject(out[key]) ? deepMerge(out[key], val) : structuredClone(val);
  }
  return out;
}

export function defaultUserConfigPath() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'leanpowers', 'config.json');
}

let cachedSchema;
function loadSchema() {
  cachedSchema ??= JSON.parse(fs.readFileSync(new URL('../../schema/leanpowers.schema.json', import.meta.url), 'utf8'));
  return cachedSchema;
}

/**
 * Merge defaults <- user config <- project config. Broken or invalid files are
 * reported in `errors` and ignored.
 */
export function loadConfig(root, { userConfigPath = defaultUserConfigPath() } = {}) {
  const schema = loadSchema();
  const errors = [];
  let config = structuredClone(DEFAULTS);
  const sources = [
    { label: 'user config', file: userConfigPath },
    { label: 'leanpowers.json', file: path.join(root, 'leanpowers.json') },
  ];
  for (const { label, file } of sources) {
    if (!fs.existsSync(file)) continue;
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`${label}: invalid JSON (${e.message})`);
      continue;
    }
    const problems = validate(parsed, schema);
    if (problems.length) {
      errors.push(...problems.map((p) => `${label}: ${p}`));
      continue;
    }
    config = deepMerge(config, parsed);
  }
  return { config, errors };
}
