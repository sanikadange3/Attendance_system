import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Users, BarChart2, LogOut, X, Shield, Calendar } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const links = [
  { to: '/admin',            label: 'Dashboard',  Icon: LayoutDashboard, end: true },
  { to: '/admin/sessions',   label: 'Sessions',   Icon: Calendar },
  { to: '/admin/students',   label: 'Students',   Icon: Users },
  { to: '/admin/attendance', label: 'Attendance', Icon: ClipboardList },
  { to: '/admin/analytics',  label: 'Analytics',  Icon: BarChart2 },
];

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full z-30 flex flex-col
        w-64 bg-surface-900 dark:bg-surface-950
        border-r border-surface-700/50
        transform transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-surface-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Shield size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-none">AttendAI</h1>
              <p className="text-surface-400 text-[11px] mt-0.5">Admin Panel</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-surface-400 hover:text-white p-1 rounded" id="sidebar-close">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200 group
                ${isActive
                  ? 'bg-primary-600/20 text-primary-400'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800'}
              `}
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} className={`transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                  {label}
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-400" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sign Out */}
        <div className="px-3 py-4 border-t border-surface-700/50">
          <button
            id="sign-out-btn"
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-surface-400 hover:text-danger-400 hover:bg-danger-500/10 transition-all duration-200"
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
