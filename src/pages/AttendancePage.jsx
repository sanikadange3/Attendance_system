import React, { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Search, Download, CheckCircle, XCircle, Edit3, Calendar, Filter, ChevronDown, List
} from 'lucide-react';
import { subscribeAttendance, subscribeStudents, subscribeSessions, logManualAttendance } from '../services/firestore';
import { exportToExcel } from '../services/excel';

export default function AttendancePage() {
  const [attendance,   setAttendance]   = useState([]);
  const [students,     setStudents]     = useState([]);
  const [sessionList,  setSessionList]  = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search,       setSearch]       = useState('');
  const [filterSession,setFilterSession]= useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterClass,  setFilterClass]  = useState('All');
  const [filterDiv,    setFilterDiv]    = useState('All');
  const [overrideModal, setOverrideModal] = useState(null);
  const [saving,       setSaving]       = useState(false);

  // Subscribe to live data
  useEffect(() => {
    const u1 = subscribeAttendance(selectedDate, setAttendance);
    const u2 = subscribeStudents(setStudents);
    const u3 = subscribeSessions(setSessionList);
    return () => { u1(); u2(); u3(); };
  }, [selectedDate]);

  // Build a map for fast student lookup
  const studentMap = useMemo(() => {
    const m = {};
    students.forEach(s => { m[s.id] = s; });
    return m;
  }, [students]);

  // Unique class & division lists for filters
  const classes   = useMemo(() => ['All', ...new Set(students.map(s => s.className).filter(Boolean))], [students]);
  const divisions = useMemo(() => ['All', ...new Set(students.map(s => s.division).filter(Boolean))], [students]);
  // We can filter by active sessions for this date if we want, but let's just make a list of unique session names that occurred
  const sessionNames = useMemo(() => ['All', ...new Set(attendance.map(a => a.sessionName).filter(Boolean))], [attendance]);

  // Build full list: present students + absent students
  const fullList = useMemo(() => {
    // If we're filtering by a specific session, check presence in that session
    if (filterSession !== 'All') {
      const sessionAtt = attendance.filter(a => a.sessionName === filterSession);
      const sessionPresentIds = new Set(sessionAtt.map(a => a.studentId));
      return [
        ...sessionAtt,
        ...students
          .filter(s => !sessionPresentIds.has(s.id))
          .map(s => ({
            studentId: s.id,
            studentName: s.name,
            status: 'Absent',
            date: selectedDate,
            sessionName: filterSession,
            _absent: true,
          })),
      ];
    }
    // Otherwise, generic present/absent for the whole day
    const anyPresentIds = new Set(attendance.map(r => r.studentId));
    return [
      ...attendance,
      ...students
        .filter(s => !anyPresentIds.has(s.id))
        .map(s => ({
          studentId: s.id,
          studentName: s.name,
          status: 'Absent',
          date: selectedDate,
          _absent: true,
        })),
    ];
  }, [attendance, students, selectedDate, filterSession]);

  // Apply all filters
  const filtered = useMemo(() => fullList.filter(r => {
    const student = studentMap[r.studentId] || {};
    const matchSearch  = r.studentName?.toLowerCase().includes(search.toLowerCase()) ||
                         student.rollNo?.toLowerCase().includes(search.toLowerCase());
    const matchSession = filterSession === 'All' || r.sessionName === filterSession;
    const matchStatus  = filterStatus === 'All' || r.status === filterStatus;
    const matchClass   = filterClass  === 'All' || student.className === filterClass;
    const matchDiv     = filterDiv    === 'All' || student.division  === filterDiv;
    return matchSearch && matchSession && matchStatus && matchClass && matchDiv;
  }), [fullList, studentMap, search, filterSession, filterStatus, filterClass, filterDiv]);

  // Stats
  const presentCount = fullList.filter(r => r.status === 'Present').length;
  const total        = students.length;
  const pct          = total ? Math.round((presentCount / total) * 100) : 0;

  // Export
  const handleExport = () => {
    const rows = filtered.map(r => {
      const s = studentMap[r.studentId] || {};
      return {
        Name:       r.studentName,
        'Roll No':  s.rollNo     || '—',
        Class:      s.className  || '—',
        Division:   s.division   || '—',
        Gender:     s.gender     || '—',
        Session:    r.sessionName|| '—',
        Status:     r.status,
        Date:       r.date,
        Time:       r.timestamp?.toDate ? format(r.timestamp.toDate(), 'hh:mm a') : '—',
        Confidence: r.confidence ? `${r.confidence}%` : '—',
        Method:     r.manual ? 'Manual' : r._absent ? '—' : 'AI',
      };
    });
    exportToExcel(rows, `attendance_${selectedDate}.xlsx`, 'Attendance');
  };

  // Manual override
  const handleOverride = async (status) => {
    if (!overrideModal) return;
    setSaving(true);
    await logManualAttendance({
      studentId:   overrideModal.studentId,
      studentName: overrideModal.studentName,
      status,
      date: selectedDate,
    });
    setSaving(false);
    setOverrideModal(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Attendance Log</h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">
            {presentCount}/{total} present &nbsp;·&nbsp;
            <span className={pct >= 75 ? 'text-success-500' : 'text-warning-500'}>{pct}%</span>
          </p>
        </div>
        <button
          id="export-attendance"
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold transition-all shadow-md shadow-primary-500/20 hover:scale-[1.02]"
        >
          <Download size={15} /> Export Excel
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3">

        {/* Date */}
        <div className="flex items-center gap-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2 text-sm shadow-sm">
          <Calendar size={14} className="text-surface-400" />
          <input
            id="date-filter"
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-transparent text-surface-700 dark:text-surface-200 outline-none cursor-pointer"
          />
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[180px] flex items-center gap-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2 text-sm shadow-sm">
          <Search size={14} className="text-surface-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or roll no…"
            className="bg-transparent text-surface-700 dark:text-surface-200 placeholder-surface-400 outline-none w-full text-sm"
          />
        </div>

        {/* Session */}
        {sessionNames.length > 1 && (
          <div className="relative flex items-center bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2 text-sm shadow-sm gap-1">
            <List size={13} className="text-surface-400 flex-shrink-0" />
            <select
              value={filterSession}
              onChange={e => setFilterSession(e.target.value)}
              className="bg-transparent text-surface-700 dark:text-surface-200 outline-none cursor-pointer pr-1 text-sm appearance-none"
            >
              {sessionNames.map(o => <option key={o} value={o}>{o === 'All' ? 'All Sessions' : o}</option>)}
            </select>
            <ChevronDown size={12} className="text-surface-400 flex-shrink-0" />
          </div>
        )}

        {/* Class */}
        <SelectFilter id="filter-class" value={filterClass} onChange={setFilterClass} options={classes} label="Class" />

        {/* Division */}
        <SelectFilter id="filter-div" value={filterDiv} onChange={setFilterDiv} options={divisions} label="Division" />

        {/* Status */}
        <div className="flex rounded-xl overflow-hidden border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 shadow-sm">
          {['All', 'Present', 'Absent'].map(s => (
            <button
              key={s}
              id={`filter-${s.toLowerCase()}`}
              onClick={() => setFilterStatus(s)}
              className={`px-3.5 py-2 text-sm font-medium transition-all
                ${filterStatus === s
                  ? 'bg-primary-600 text-white'
                  : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700/50 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100 dark:border-surface-700/50 text-left">
              {['Student', 'Roll No', 'Class', 'Session', 'Status', 'Time', 'Confidence', 'Method', 'Action']
                .map(h => (
                  <th key={h} className="px-4 py-3.5 text-[11px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-surface-400 text-sm">
                  No records found for the selected filters.
                </td>
              </tr>
            ) : filtered.map((r, i) => {
              const s = studentMap[r.studentId] || {};
              return (
                <tr key={r.id || i} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                  {/* Student */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                        {r.studentName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="font-medium text-surface-800 dark:text-surface-200 whitespace-nowrap">{r.studentName}</span>
                    </div>
                  </td>
                  {/* Roll No */}
                  <td className="px-4 py-3 text-surface-500 dark:text-surface-400 font-mono text-xs">{s.rollNo || '—'}</td>
                  {/* Class + Division */}
                  <td className="px-4 py-3 text-surface-500 dark:text-surface-400 text-xs whitespace-nowrap">
                    {[s.className, s.division].filter(Boolean).join(' · ') || '—'}
                  </td>
                  {/* Session */}
                  <td className="px-4 py-3 text-surface-500 dark:text-surface-400 text-xs font-medium whitespace-nowrap">
                    {r.sessionName || '—'}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold
                      ${r.status === 'Present' ? 'bg-success-500/10 text-success-500' : 'bg-danger-500/10 text-danger-400'}`}>
                      {r.status === 'Present' ? <CheckCircle size={11} /> : <XCircle size={11} />}
                      {r.status}
                    </span>
                  </td>
                  {/* Time */}
                  <td className="px-4 py-3 text-surface-500 dark:text-surface-400 text-xs whitespace-nowrap">
                    {r.timestamp?.toDate ? format(r.timestamp.toDate(), 'hh:mm a') : '—'}
                  </td>
                  {/* Confidence */}
                  <td className="px-4 py-3">
                    {r.confidence ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 bg-surface-200 dark:bg-surface-600 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${r.confidence}%` }} />
                        </div>
                        <span className="text-xs text-surface-400">{r.confidence}%</span>
                      </div>
                    ) : <span className="text-xs text-surface-400">—</span>}
                  </td>
                  {/* Method */}
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md
                      ${r.manual ? 'bg-warning-500/10 text-warning-500' : r._absent ? 'bg-surface-100 dark:bg-surface-700 text-surface-400' : 'bg-primary-500/10 text-primary-400'}`}>
                      {r.manual ? 'Manual' : r._absent ? '—' : 'AI'}
                    </span>
                  </td>
                  {/* Override */}
                  <td className="px-4 py-3">
                    <button
                      id={`override-${r.studentId}`}
                      onClick={() => setOverrideModal(r)}
                      className="flex items-center gap-1 text-xs text-surface-400 hover:text-primary-500 transition-colors px-2 py-1 rounded-lg hover:bg-primary-500/10"
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-2xl p-6 w-full max-w-sm mx-4 animate-scale-in">
            <h3 className="font-bold text-surface-900 dark:text-white mb-1">Override Attendance</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-5">
              Set status for <strong className="text-surface-800 dark:text-surface-200">{overrideModal.studentName}</strong> on {selectedDate}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleOverride('Present')} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-success-500 hover:bg-success-400 text-white text-sm font-semibold transition-all shadow-md shadow-success-500/30"
              >✓ Present</button>
              <button
                onClick={() => handleOverride('Absent')} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-danger-500 hover:bg-danger-400 text-white text-sm font-semibold transition-all shadow-md shadow-danger-500/30"
              >✗ Absent</button>
            </div>
            <button onClick={() => setOverrideModal(null)}
              className="w-full mt-3 py-2 text-sm text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectFilter({ id, value, onChange, options, label }) {
  return (
    <div className="relative flex items-center bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl px-3 py-2 text-sm shadow-sm gap-1">
      <Filter size={13} className="text-surface-400 flex-shrink-0" />
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent text-surface-700 dark:text-surface-200 outline-none cursor-pointer pr-1 text-sm appearance-none"
      >
        {options.map(o => <option key={o} value={o}>{o === 'All' ? `All ${label}` : o}</option>)}
      </select>
      <ChevronDown size={12} className="text-surface-400 flex-shrink-0" />
    </div>
  );
}
