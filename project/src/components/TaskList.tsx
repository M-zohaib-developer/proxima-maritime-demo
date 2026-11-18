import { useState } from 'react';
import { CheckCircle2, ListTodo, Mail, Plus, RotateCcw } from 'lucide-react';
import { useDemoStore, uid } from '@/lib/demoStore';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { Avatar, EmptyState, Field } from '@/components/ui';
import { PriorityBadge, TaskStatusBadge } from '@/components/StatusBadge';
import { fmtLt, fromInputValue, hoursBetween, isValidLt, nowIso, toInputValue } from '@/lib/time';
import type { Task, TaskStatus } from '@/types';

const CATEGORY_LABEL: Record<Task['category'], string> = {
  'crew-change': 'Crew change', provisions: 'Provisions', documents: 'Documents', transit: 'Suez transit', other: 'Operations',
};

export default function TaskList({ tasks, showVessel = true, emptyText = 'No tasks.' }: { tasks: Task[]; showVessel?: boolean; emptyText?: string }) {
  const { state, dispatch, navigate } = useDemoStore();
  const { showToast } = useToast();
  const setStatus = (t: Task, status: TaskStatus) => {
    dispatch({ type: 'SET_TASK_STATUS', taskId: t.id, status, at: nowIso() });
    if (status === 'Done') showToast('success', 'Task completed', t.title);
  };

  if (!tasks.length) return <EmptyState icon={<ListTodo size={18} />} title={emptyText} />;
  const sorted = [...tasks].sort((a, b) => (a.status === 'Done' ? 1 : 0) - (b.status === 'Done' ? 1 : 0) || a.dueAt.localeCompare(b.dueAt));

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm min-w-[820px]">
        <thead>
          <tr>
            <th className="th">Task</th>
            {showVessel && <th className="th">Vessel</th>}
            <th className="th">Owner</th>
            <th className="th">Due (LT)</th>
            <th className="th">Priority</th>
            <th className="th">Status</th>
            <th className="th text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(t => {
            const assignee = state.staff.find(s => s.id === t.assigneeId);
            return (
              <tr key={t.id} className={`border-b border-line last:border-0 tr-hover cursor-default ${t.status === 'Done' ? 'text-slate' : ''}`}>
                <td className="td max-w-[24rem]">
                  <p className={`font-medium ${t.status === 'Done' ? 'line-through text-slate' : 'text-graphite'}`}>{t.title}</p>
                  <p className="text-2xs text-slate mt-0.5 line-clamp-2">{t.description}</p>
                  <div className="flex flex-wrap gap-x-2 mt-1 text-2xs text-slate">
                    <span>{CATEGORY_LABEL[t.category]}</span>
                    {t.createdFrom === 'email' && <span className="inline-flex items-center gap-1 text-teal-700"><Mail size={10} />from email</span>}
                    {t.rule && <span title={t.rule}>· {t.rule}</span>}
                  </div>
                </td>
                {showVessel && <td className="td"><button className="text-harbor-600 hover:underline text-sm whitespace-nowrap" onClick={() => navigate('port-call-detail', t.portCallId, 'tasks')}>{t.vesselName}</button></td>}
                <td className="td"><span className="flex items-center gap-2 whitespace-nowrap">{assignee && <Avatar initials={assignee.initials} size={22} />}{assignee?.name ?? '—'}</span></td>
                <td className="td tabular whitespace-nowrap">{fmtLt(t.dueAt)}</td>
                <td className="td"><PriorityBadge priority={t.priority} /></td>
                <td className="td"><TaskStatusBadge status={t.status} /></td>
                <td className="td text-right whitespace-nowrap">
                  {t.status === 'Done' ? (
                    <button className="btn-ghost btn-sm" onClick={() => setStatus(t, 'Open')}><RotateCcw size={12} />Reopen</button>
                  ) : (
                    <div className="inline-flex gap-1">
                      {t.status === 'Open' && <button className="btn-ghost btn-sm" onClick={() => setStatus(t, 'In Progress')}>Start</button>}
                      <button className="btn-secondary btn-sm" onClick={() => setStatus(t, 'Done')} aria-label={`Mark ${t.title} done`}><CheckCircle2 size={13} className="text-success" />Done</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function NewTaskButton({ defaultPortCallId }: { defaultPortCallId?: string }) {
  const { state, dispatch } = useDemoStore();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const calls = state.portCalls.filter(p => p.status !== 'Completed');
  const initial = () => {
    const pc = calls.find(p => p.id === defaultPortCallId) ?? calls[0];
    return { portCallId: pc?.id ?? '', title: '', description: '', category: 'other' as Task['category'], assigneeId: state.currentUserId, dueAt: pc ? toInputValue(pc.etb) : '', priority: 'Medium' as Task['priority'] };
  };
  const [f, setF] = useState(initial);
  const [touched, setTouched] = useState(false);
  const pc = state.portCalls.find(p => p.id === f.portCallId);
  const errs = {
    portCallId: !pc ? 'Choose a port call' : undefined,
    title: f.title.trim().length < 3 ? 'Title is required' : undefined,
    dueAt: !isValidLt(fromInputValue(f.dueAt)) ? 'Valid due time required' : undefined,
  };
  const valid = !errs.portCallId && !errs.title && !errs.dueAt;

  function save() {
    setTouched(true);
    if (!valid || !pc) return;
    const dueAt = fromInputValue(f.dueAt);
    const task: Task = {
      id: uid('tsk'), portCallId: pc.id, vesselName: pc.vesselName, category: f.category, title: f.title.trim(), description: f.description.trim(),
      assigneeId: f.assigneeId, dueAt, priority: f.priority, status: 'Open', createdFrom: 'manual',
      etbOffsetHours: f.category === 'crew-change' || f.category === 'provisions' ? hoursBetween(pc.etb, dueAt) : undefined,
    };
    dispatch({ type: 'CREATE_TASKS', tasks: [task], at: nowIso() });
    showToast('success', 'Task created', `${task.title} — ${pc.vesselName}`);
    setOpen(false);
  }

  return (
    <>
      <button className="btn-primary btn-sm" onClick={() => { setF(initial()); setTouched(false); setOpen(true); }}><Plus size={14} />New task</button>
      <Modal open={open} onClose={() => setOpen(false)} title="New task" size="lg"
        footer={<><button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={save}>Create task</button></>}>
        <form className="grid sm:grid-cols-2 gap-3" onSubmit={e => { e.preventDefault(); save(); }}>
          <div className="sm:col-span-2">
            <Field label="Title" htmlFor="t-title" error={touched ? errs.title : undefined}>
              <input id="t-title" className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Arrange shore pass for surveyor" />
            </Field>
          </div>
          <Field label="Port call" htmlFor="t-pc" error={touched ? errs.portCallId : undefined}>
            <select id="t-pc" className="input" value={f.portCallId} onChange={e => setF({ ...f, portCallId: e.target.value })}>
              {calls.map(p => <option key={p.id} value={p.id}>{p.vesselName} — {p.port}</option>)}
            </select>
          </Field>
          <Field label="Category" htmlFor="t-cat">
            <select id="t-cat" className="input" value={f.category} onChange={e => setF({ ...f, category: e.target.value as Task['category'] })}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Owner" htmlFor="t-own">
            <select id="t-own" className="input" value={f.assigneeId} onChange={e => setF({ ...f, assigneeId: e.target.value })}>
              {state.staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.desk}</option>)}
            </select>
          </Field>
          <Field label="Due (LT)" htmlFor="t-due" error={touched ? errs.dueAt : undefined}>
            <input id="t-due" type="datetime-local" className="input" value={f.dueAt} onChange={e => setF({ ...f, dueAt: e.target.value })} />
          </Field>
          <Field label="Priority" htmlFor="t-pri">
            <select id="t-pri" className="input" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as Task['priority'] })}>
              {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes" htmlFor="t-desc">
              <textarea id="t-desc" rows={2} className="input" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}
