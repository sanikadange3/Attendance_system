import React, { useEffect, useState } from 'react';
import { Users, CheckCircle, XCircle, Camera, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import StatCard from '../components/StatCard';
import { subscribeStudents, subscribeAttendance } from '../services/firestore';

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const unsub1 = subscribeStudents(setStudents);
    const unsub2 = subscribeAttendance(today, setTodayAttendance);
    return () => { unsub1(); unsub2(); };
  }, [today]);

  const presentCount = todayAttendance.filter(r => r.status === 'Present').length;
  const absentCount = students.length - presentCount;
  const pct = students.length ? Math.round((presentCount / students.length) * 100) : 0;

  const recent = todayAttendance.slice(0, 8);

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight">
          Good {getGreeting()}, Admin 👋
        </h1>
        <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
          {format(new Date(), 'EEEE, MMMM d yyyy')} · Attendance overview
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Total Students" value={students.length}  color="primary" />
        <StatCard icon={CheckCircle} label="Present Today"  value={presentCount}     color="success" trend={5} />
        <StatCard icon={XCircle}     label="Absent Today"   value={absentCount}      color="danger"  />
        <StatCard icon={TrendingUp}  label="Attendance %"   value={`${pct}%`}        color="accent"  />
      </div>

      {/* Attendance rate bar */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700/50 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-surface-800 dark:text-white text-sm">Today's Attendance Rate</h3>
          <span className="text-sm font-bold text-primary-500">{pct}%</span>
        </div>
        <div className="h-3 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-surface-400 mt-2">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>

      {/* Recent log */}
      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700/50 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 dark:border-surface-700/50">
          <h3 className="font-semibold text-surface-800 dark:text-white text-sm">Recent Attendance Logs</h3>
          <span className="text-xs text-surface-400">{format(new Date(), 'MMM d')}</span>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-surface-400">
            <Camera size={36} className="mb-3 opacity-40" />
            <p className="text-sm">No attendance logged yet today</p>
            <p className="text-xs mt-1">Start the camera to detect students</p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-100 dark:divide-surface-700/50">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-white text-xs font-bold">
                    {r.studentName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{r.studentName}</p>
                    <p className="text-xs text-surface-400">
                      {r.timestamp?.toDate ? format(r.timestamp.toDate(), 'hh:mm a') : '—'}
                      {r.confidence ? ` · ${r.confidence}% confidence` : ''}
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold
                  ${r.status === 'Present'
                    ? 'bg-success-500/10 text-success-500'
                    : 'bg-danger-500/10 text-danger-400'}`}>
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
