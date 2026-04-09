import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Calendar, Clock, AlertTriangle, Play, CheckCircle } from 'lucide-react';
import { subscribeSessions, createSession, deleteSession } from '../services/firestore';
import { format, isPast, isFuture, isWithinInterval } from 'date-fns';

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    return subscribeSessions(setSessions);
  }, []);

  const getStatus = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    const now = new Date();
    if (isFuture(s)) return { label: 'Upcoming', color: 'text-warning-500 bg-warning-500/10' };
    if (isPast(e)) return { label: 'Ended', color: 'text-surface-400 bg-surface-100 dark:bg-surface-800' };
    return { label: 'Active Now', color: 'text-success-500 bg-success-500/10 animate-pulse' };
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Attendance Sessions</h1>
          <p className="text-surface-500 text-sm mt-0.5">Manage temporary windows for marking attendance</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 text-xs py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold shadow-md shadow-primary-500/20 transition-all"
        >
          <Plus size={14} /> Create Session
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.length === 0 ? (
          <div className="col-span-full text-center py-20 text-surface-400">
            <Calendar size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest italic">No sessions created</p>
          </div>
        ) : sessions.map(session => {
          const status = getStatus(session.startTime, session.endTime);
          return (
            <div key={session.id} className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700/50 rounded-2xl p-5 shadow-sm group">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg text-surface-900 dark:text-white truncate pr-4">{session.name}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-surface-500 dark:text-surface-400 mb-5">
                <div className="flex items-center gap-2">
                  <Play size={12} className="text-surface-400" />
                  <span>{format(new Date(session.startTime), 'MMM d, yyyy • h:mm a')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={12} className="text-surface-400" />
                  <span>{format(new Date(session.endTime), 'MMM d, yyyy • h:mm a')}</span>
                </div>
              </div>
              <div className="flex justify-end pt-3 border-t border-surface-100 dark:border-surface-700/50">
                <button
                  onClick={() => { if (confirm('Delete this session?')) deleteSession(session.id); }}
                  className="text-surface-400 hover:text-danger-500 p-1.5 rounded-lg hover:bg-danger-500/10 transition-colors"
                  title="Delete Session"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && <AddSessionModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddSessionModal({ onClose }) {
  // Default to now till next hour
  const now = new Date();
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
  
  const toLocalISO = (d) => {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [form, setForm] = useState({
    name: '',
    startTime: toLocalISO(now),
    endTime: toLocalISO(nextHour)
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const s = new Date(form.startTime);
    const end = new Date(form.endTime);

    if (!form.name.trim()) return setError('Name is required.');
    if (end <= s) return setError('End time must be after start time.');

    setSaving(true);
    try {
      await createSession({
        name: form.name.trim(),
        startTime: s.toISOString(),
        endTime: end.toISOString()
      });
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-surface-800 rounded-3xl border border-surface-200 dark:border-surface-700 shadow-2xl p-8 w-full max-w-md animate-scale-in">
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-6">Create Session</h2>
        
        {error && (
          <div className="flex items-center gap-2 bg-danger-500/10 border border-danger-500/20 text-danger-500 text-sm px-3 py-2 rounded-xl mb-4">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-surface-400 mb-1">Session Name *</label>
            <input
              required autoFocus
              value={form.name}
              onChange={e => setForm(p => ({...p, name: e.target.value}))}
              placeholder="e.g. Morning Class IT"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-sm focus:ring-2 focus:ring-primary-500/30 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-surface-400 mb-1">Start Time *</label>
              <input
                required type="datetime-local"
                value={form.startTime}
                onChange={e => setForm(p => ({...p, startTime: e.target.value}))}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-sm focus:ring-2 focus:ring-primary-500/30 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-surface-400 mb-1">End Time *</label>
              <input
                required type="datetime-local"
                value={form.endTime}
                onChange={e => setForm(p => ({...p, endTime: e.target.value}))}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-sm focus:ring-2 focus:ring-primary-500/30 outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 rounded-2xl text-sm font-bold transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-[2] py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-primary-500/20 transition-colors">
              {saving ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
