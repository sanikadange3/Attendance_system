import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { TrendingUp, TrendingDown, Users, Award } from 'lucide-react';
import { getAllAttendance, getAllStudents } from '../services/firestore';

const COLORS = ['#3b82f6', '#ef4444', '#8b5cf6', '#22c55e', '#f59e0b'];

export default function AnalyticsPage() {
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllAttendance(), getAllStudents()]).then(([att, stu]) => {
      setAttendance(att);
      setStudents(stu);
      setLoading(false);
    });
  }, []);

  // Build last 14 days trend
  const trendData = Array.from({ length: 14 }, (_, i) => {
    const date = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd');
    const dayAtt = attendance.filter(a => a.date === date);
    const present = dayAtt.filter(a => a.status === 'Present').length;
    const total = students.length || 1;
    return {
      date: format(parseISO(date), 'MMM d'),
      present,
      absent: total - present,
      pct: Math.round((present / total) * 100),
    };
  });

  // Weekly bar: group by day-of-week
  const byDow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
    const dayPct = trendData
      .filter((_, idx) => new Date(subDays(new Date(), 13 - idx)).getDay() === ((i + 1) % 7))
      .map(d => d.pct);
    const avg = dayPct.length ? Math.round(dayPct.reduce((a, b) => a + b, 0) / dayPct.length) : 0;
    return { day, avg };
  });

  // Pie: Present vs Absent today
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayAtt = attendance.filter(a => a.date === today);
  const presentToday = todayAtt.filter(a => a.status === 'Present').length;
  const absentToday = (students.length || 0) - presentToday;
  const pieData = [
    { name: 'Present', value: presentToday },
    { name: 'Absent',  value: Math.max(absentToday, 0) },
  ];

  // Top attendees
  const studentPct = students.map(s => {
    const attended = attendance.filter(a => a.studentId === s.id && a.status === 'Present').length;
    const total = Math.max(new Set(attendance.map(a => a.date)).size, 1);
    return { name: s.name, pct: Math.round((attended / total) * 100) };
  }).sort((a, b) => b.pct - a.pct).slice(0, 5);

  const avgPct = trendData.length ? Math.round(trendData.reduce((a, b) => a + b.pct, 0) / trendData.length) : 0;
  const lastWeekAvg = Math.round(trendData.slice(0, 7).reduce((a, b) => a + b.pct, 0) / 7);
  const thisWeekAvg = Math.round(trendData.slice(7).reduce((a, b) => a + b.pct, 0) / 7);
  const trend = thisWeekAvg - lastWeekAvg;

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white tracking-tight">Analytics</h1>
        <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">Attendance trends and insights</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-surface-400 text-sm">Loading analytics…</div>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: '14-day Avg', value: `${avgPct}%`, icon: TrendingUp, color: 'text-primary-500' },
              { label: 'This Week', value: `${thisWeekAvg}%`, icon: trend >= 0 ? TrendingUp : TrendingDown, color: trend >= 0 ? 'text-success-500' : 'text-danger-400' },
              { label: 'Total Students', value: students.length, icon: Users, color: 'text-accent-500' },
              { label: 'Week Trend', value: `${trend >= 0 ? '+' : ''}${trend}%`, icon: Award, color: trend >= 0 ? 'text-success-500' : 'text-danger-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700/50 p-4 shadow-sm">
                <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">{label}</p>
                <div className="flex items-center gap-2">
                  <Icon size={18} className={color} />
                  <span className="text-xl font-bold text-surface-900 dark:text-white">{value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Area chart - 14 day trend */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700/50 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-surface-800 dark:text-white mb-4">14-Day Attendance Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#60a5fa' }}
                  formatter={v => [`${v}%`, 'Attendance']}
                />
                <Area type="monotone" dataKey="pct" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradPresent)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Bar + Pie row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Weekly bar */}
            <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700/50 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-surface-800 dark:text-white mb-4">Avg Attendance by Day</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byDow} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                    formatter={v => [`${v}%`, 'Avg']}
                  />
                  <Bar dataKey="avg" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie */}
            <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700/50 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-surface-800 dark:text-white mb-4">Today's Status Distribution</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top students */}
          <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700/50 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-surface-800 dark:text-white mb-4">Top Attendees</h3>
            <div className="space-y-3">
              {studentPct.length === 0 ? (
                <p className="text-sm text-surface-400 text-center py-4">No data yet</p>
              ) : studentPct.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-surface-400 font-mono text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-surface-800 dark:text-surface-200">{s.name}</span>
                      <span className="text-surface-400">{s.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${s.pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
