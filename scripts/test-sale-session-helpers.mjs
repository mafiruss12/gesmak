// Lightweight pure checks for 3B.2 helpers (no DOM).
function shouldAppDecrementStock(online) {
  return !online;
}
function applySaleSessionFields(payload, resolved) {
  const out = { ...payload };
  if (resolved.sessionId) out.cash_session_id = resolved.sessionId;
  out._client_op_id = resolved.clientOpId;
  return out;
}
let fails = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    fails++;
  } else console.log('OK', msg);
}
assert(shouldAppDecrementStock(true) === false, 'online: no app stock decrement');
assert(shouldAppDecrementStock(false) === true, 'offline: app stock decrement');
const p = applySaleSessionFields({ a: 1 }, { ok: true, sessionId: 's1', clientOpId: 'c1', requireSession: false });
assert(p.cash_session_id === 's1', 'session attached');
assert(p._client_op_id === 'c1', 'client_op attached');
const p2 = applySaleSessionFields({ a: 1 }, { ok: true, sessionId: null, clientOpId: 'c2', requireSession: false });
assert(p2.cash_session_id === undefined, 'no session when null');
process.exit(fails ? 1 : 0);
