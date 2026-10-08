import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function deepMerge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    out[k] = isObject(v) && isObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
}

// config.json（共有の既定値）に config.local.json（個人設定・git管理外）を上書きする
export function loadConfig(overrides = {}) {
  const base = readJson(path.join(ROOT, 'config.json'));
  const local = readJson(path.join(ROOT, 'config.local.json'));
  return deepMerge(deepMerge(base, local), overrides);
}
