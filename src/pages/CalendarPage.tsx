import { useEffect, useState } from 'react';
import { Calendar, Plus, Clock, CheckCircle2, Play, Square, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Shift, Employee } from '@/lib/types';
import { formatTime, formatDate } from '@/lib/format';
import { Modal, EmptyState, Badge } from '@/components/ui';

export default function CalendarPage() {
  const { member } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: '', date: todayStr(), start: '08:00', end: '17:00', notes: '' });
  const [weekOffset, setWeekOffset] = useState(0);

  function todayStr() { return new Date().toISOString().split('T')[0]; }

  async function load() {
    if (!member?.establishment_id) { setLoading(false); return; }
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() + weekOffset * 7 - startOfWeek.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const [shiftRes, empRes] = await Promise.all([
      supabase.from('shifts').select('*').eq('establishment_id', member.establishment_id).gte('start_time', startOfWeek.toISOString()).lt('start_time', endOfWeek.toISOString()).order('start_time'),
      supabase.from('employees').select('*').eq('establishment_id', member.establishment_id).eq('status', 'active').order('name'),
    ]);
    setShifts((shiftRes.data ?? []) as Shift[]);
    setEmployees((empRes.data ?? []) as Employee[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [member, weekOffset]);

  async function save() {
    if (!member?.establishment_id || !form.employee_id) return;
    const startDate = new Date(`${form.date}T${form.start}`);
    const endDate = new Date(`${form.date}T${form.end}`);
    await supabase.from('shifts').insert({
      establishment_id: member.establishment_id,
      employee_id: form.employee_id,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: 'scheduled',
      notes: form.notes || null,
    });
    setModalOpen(false);
    setForm({ employee_id: '', date: todayStr(), start: '08:00', end: '17:00', notes: '' });
    await load();
  }

  async function advanceShift(s: Shift) {
    const next: Record<string, string> = { scheduled: 'active', active: 'completed' };
    if (s.status === 'active') {
      await supabase.from('shifts').update({ status: 'completed', end_time: new Date().toISOString() }).eq('id', s.id);
    } else {
      await supabase.from('shifts').update({ status: next[s.status] }).eq('id', s.id);
    }
    await load();
  }

  async function cancelShift(s: Shift) {
    await supabase.from('shifts').update({ status: 'cancelled' }).eq('id', s.id);
    await load();
  }

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() + weekOffset * 7 - weekStart.getDay() + 1);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  function getShiftsForDay(date: Date) {
    const ds = date.toISOString().split('T')[0];
    return shifts.filter((s) => s.start_time.startsWith(ds));
  }

  function getEmployeeName(id: string) {
    return employees.find((e) => e.id === id)?.name ?? 'Inconnu';
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) return <EmptyState icon={<Calendar size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Planning</h1>
          <p className="text-stone-400 text-sm">Gérez les horaires de vos employés</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(weekOffset - 1)} className="btn-ghost px-3 py-2">←</button>
          <span className="text-sm text-stone-300 font-medium">
            {weekOffset === 0 ? 'Cette semaine' : weekOffset < 0 ? `${Math.abs(weekOffset)} sem. avant` : `${weekOffset} sem. après`}
          </span>
          <button onClick={() => setWeekOffset(weekOffset + 1)} className="btn-ghost px-3 py-2">→</button>
          <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2 ml-2"><Plus size={18} /> Shift</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {weekDays.map((day, i) => {
          const dayShifts = getShiftsForDay(day);
          const isToday = day.toISOString().split('T')[0] === todayStr();
          return (
            <div key={i} className={`card min-h-[120px] ${isToday ? 'border-primary-500/40 bg-primary-500/5' : ''}`}>
              <p className={`text-sm font-semibold mb-2 capitalize ${isToday ? 'text-primary-300' : 'text-stone-300'}`}>
                {day.toLocaleDateString('fr-FR', { weekday: 'short' })} {day.getDate()}
              </p>
              <div className="space-y-1.5">
                {dayShifts.length === 0 ? (
                  <p className="text-xs text-stone-600">Repos</p>
                ) : (
                  dayShifts.map((s) => (
                    <div key={s.id} className={`rounded-lg p-2 text-xs transition-all ${
                      s.status === 'active' ? 'bg-success-500/15 border border-success-500/30' :
                      s.status === 'completed' ? 'bg-stone-800/50' :
                      s.status === 'cancelled' ? 'bg-error-500/10 opacity-60' :
                      'bg-stone-800'
                    }`}>
                      <p className="font-medium text-stone-200 truncate">{getEmployeeName(s.employee_id)}</p>
                      <p className="text-stone-400 flex items-center gap-1"><Clock size={10} /> {formatTime(s.start_time)} - {s.end_time ? formatTime(s.end_time) : '...'}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {s.status === 'scheduled' && <button onClick={() => advanceShift(s)} className="text-success-400 hover:text-success-300" title="Démarrer"><Play size={12} /></button>}
                        {s.status === 'active' && <button onClick={() => advanceShift(s)} className="text-warning-400 hover:text-warning-300" title="Terminer"><Square size={12} /></button>}
                        {s.status !== 'cancelled' && s.status !== 'completed' && (
                          <button onClick={() => cancelShift(s)} className="text-error-400 hover:text-error-300 ml-auto" title="Annuler"><X size={12} /></button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau shift">
        <div className="space-y-3">
          <div>
            <label className="label">Employé</label>
            <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="input-field">
              <option value="">— Choisir —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Début</label>
              <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label">Fin</label>
              <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" placeholder="Mission particulière..." />
          </div>
          <button onClick={save} className="btn-primary w-full">Planifier</button>
        </div>
      </Modal>
    </div>
  );
}
