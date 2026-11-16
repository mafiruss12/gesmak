#!/usr/bin/env node
/**
 * Static checks on GESMAK 3B migration (no DB required).
 * Exit 0 = pass, 1 = fail.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const file = resolve(
  process.cwd(),
  'supabase/migrations/20261116_multi_services_caisses_v1.sql'
);
if (!existsSync(file)) {
  console.error('FAIL: migration file missing', file);
  process.exit(1);
}
const sql = readFileSync(file, 'utf8');
const upper = sql.toUpperCase();
const fails = [];
const forb = [
  [/\bDROP\s+TABLE\b/i, 'DROP TABLE forbidden'],
  [/\bTRUNCATE\b/i, 'TRUNCATE forbidden'],
  [/\bDELETE\s+FROM\b/i, 'DELETE FROM forbidden'],
  [/\bDROP\s+COLUMN\b/i, 'DROP COLUMN forbidden'],
];
for (const [re, msg] of forb) {
  if (re.test(sql)) fails.push(msg);
}
const need = [
  'services',
  'cash_registers',
  'service_assignments',
  'cash_register_assignments',
  'approval_requests',
  'cash_session_id',
  'assignment_kind',
  'uq_cash_sessions_one_open_per_register',
  'technical_compat',
];
for (const n of need) {
  if (!sql.toLowerCase().includes(n.toLowerCase())) fails.push('missing: ' + n);
}
if (!/CREATE TABLE IF NOT EXISTS\s+public\.services/i.test(sql)) {
  fails.push('services must use IF NOT EXISTS');
}
if (!/ADD COLUMN IF NOT EXISTS/i.test(sql)) {
  fails.push('extensions must use ADD COLUMN IF NOT EXISTS');
}
if (fails.length) {
  console.error('FAIL');
  fails.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('OK: 3B migration static checks passed');
console.log(' - no destructive DDL/DML patterns');
console.log(' - required tables/columns/indexes present');
process.exit(0);
