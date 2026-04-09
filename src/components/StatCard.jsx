import React from 'react';

export default function StatCard({ icon: Icon, label, value, sub, color = 'primary', trend }) {
  const colorMap = {
    primary: 'from-primary-500 to-primary-600 shadow-primary-500/30',
    success: 'from-success-500 to-success-400 shadow-success-500/30',
    warning: 'from-warning-500 to-warning-400 shadow-warning-500/30',
    danger:  'from-danger-500  to-danger-400  shadow-danger-500/30',
    accent:  'from-accent-500  to-accent-600  shadow-accent-500/30',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl
      bg-white dark:bg-surface-800
      border border-surface-100 dark:border-surface-700/50
      p-5 shadow-sm hover:shadow-md
      transition-all duration-300 hover:-translate-y-0.5
      animate-slide-up group"
    >
      {/* subtle gradient background blob */}
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br ${colorMap[color]} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />

      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold mt-1 text-surface-900 dark:text-white leading-none">{value}</p>
          {sub && <p className="text-xs text-surface-400 dark:text-surface-500 mt-1.5">{sub}</p>}
          {trend !== undefined && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium mt-2 px-2 py-0.5 rounded-full
              ${trend >= 0 ? 'text-success-500 bg-success-500/10' : 'text-danger-400 bg-danger-500/10'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last week
            </span>
          )}
        </div>
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${colorMap[color]} shadow-lg flex items-center justify-center flex-shrink-0`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}
