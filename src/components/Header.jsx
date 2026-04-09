import React, { useEffect, useState } from 'react';
import { Menu, Sun, Moon, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { subscribeStudents, subscribeAttendance } from '../services/firestore';
import { format } from 'date-fns';

export default function Header({ onMenuClick, isPublic = false }) {
  const { dark, toggleDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [presentCount, setPresentCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    const unsubStudents = subscribeStudents(s => setTotalStudents(s.length));
    const today = format(new Date(), 'yyyy-MM-dd');
    const unsubAtt = subscribeAttendance(today, att => {
      setPresentCount(new Set(att.filter(a => a.status === 'Present').map(a => a.studentId)).size);
    });
    return () => { unsubStudents(); unsubAtt(); };
  }, []);

  return (
    <header className="w-full flex items-center justify-between px-4 sm:px-6 py-3
      bg-white/90 dark:bg-surface-900/90 backdrop-blur-md
      border-b border-surface-200 dark:border-surface-700/50 sticky top-0 z-20">

      {/* Left */}
      <div className="flex items-center gap-3">
        {!isPublic && onMenuClick && (
          <button onClick={onMenuClick} id="menu-toggle"
            className="lg:hidden p-2 rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
            <Menu size={20} />
          </button>
        )}

        {isPublic && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <span className="font-bold text-surface-800 dark:text-white text-sm tracking-tight">AttendAI</span>
          </div>
        )}

        {/* Live counter (for admin header) */}
        {!isPublic && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-500/10 text-success-500 border border-success-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider">{presentCount}/{totalStudents} Present Today</span>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button onClick={toggleDark} id="theme-toggle" aria-label="Toggle theme"
          className="p-2 rounded-xl text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all">
          {dark ? <Sun size={18} className="text-warning-400" /> : <Moon size={18} />}
        </button>

        {/* Auth button */}
        {user ? (
          <div className="flex items-center gap-2 ml-1 pl-3 border-l border-surface-200 dark:border-surface-700">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-white text-xs font-bold">
              {user.email?.[0]?.toUpperCase() || 'A'}
            </div>
            <span className="hidden sm:block text-sm font-medium text-surface-700 dark:text-surface-300 max-w-[120px] truncate">
              {user.displayName || user.email}
            </span>
            <button
              onClick={() => signOut(auth).then(() => navigate('/'))}
              className="ml-1 text-xs text-surface-400 hover:text-danger-500 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-danger-500/10"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link to="/login" className="flex items-center gap-2 ml-1 pl-3 border-l border-surface-200 dark:border-surface-700">
            <div className="flex items-center gap-2 px-4 py-2 bg-surface-900 dark:bg-white text-white dark:text-surface-900 rounded-xl text-xs font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all border border-surface-700 dark:border-white/20 group">
              <Shield size={14} className="text-primary-400 dark:text-primary-600 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:block uppercase tracking-wider">Admin Login</span>
              <span className="sm:hidden uppercase tracking-wider">Admin</span>
            </div>
          </Link>
        )}
      </div>
    </header>
  );
}
