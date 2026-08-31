import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../lib/api/auth';
import { User, LogOut } from 'lucide-react';

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const initials = user.first_name 
    ? `${user.first_name[0]}${user.last_name ? user.last_name[0] : ''}` 
    : user.email.substring(0, 2).toUpperCase();

  return (
    <div className="fixed top-4 right-4 z-50" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-white dark:border-zinc-800 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold shadow-sm hover:ring-2 hover:ring-blue-400 focus:outline-none transition-all"
      >
        {initials}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-zinc-900 ring-1 ring-black ring-opacity-5 border border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="py-3 px-4 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {user.first_name ? `${user.first_name} ${user.last_name}` : 'User Profile'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              {user.email}
            </p>
            {user.is_recruiter && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider rounded">
                Recruiter
              </span>
            )}
          </div>
          <div className="py-1">
            {user.is_recruiter && (
              <button
                onClick={() => { setIsOpen(false); navigate('/search'); }}
                className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
              >
                <User className="w-4 h-4 opacity-70" />
                Recruiter Search
              </button>
            )}
            <button
              onClick={() => { setIsOpen(false); navigate('/profile'); }}
              className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"
            >
              <User className="w-4 h-4 opacity-70" />
              My Global Profile
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 mt-1 pt-2"
            >
              <LogOut className="w-4 h-4 opacity-70" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
