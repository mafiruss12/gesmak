import { supabase } from './supabase';

export type AuditPayload = {
  establishment_id: string | null | undefined;
  actor_id?: string | null;
  actor_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  entity_label?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  reason?: string | null;
  client_op_id?: string | null;
};

/** Trace une action sensible. Ne bloque jamais l'UI si l'insert échoue. */
export async function logAudit(p: AuditPayload): Promise<void> {
  if (!p.establishment_id || !p.action) return;
  try {
    const row = {
      establishment_id: p.establishment_id,
      actor_id: p.actor_id || null,
      actor_name: p.actor_name || null,
      action: p.action,
      entity_type: p.entity_type,
      entity_id: p.entity_id || null,
      entity_label: p.entity_label || null,
      old_value: p.old_value ?? null,
      new_value: p.new_value ?? null,
      reason: p.reason || null,
      client_op_id: p.client_op_id || `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };
    const { error } = await supabase.from('operation_audit').insert(row);
    if (error) {
      // table absente ou RLS : ignorer en silence côté UX
      console.warn('[audit]', error.message);
    }
  } catch (e) {
    console.warn('[audit]', e);
  }
}

export function newClientOpId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
