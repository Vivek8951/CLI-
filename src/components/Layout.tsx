import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { FileText, LayoutDashboard, Users, HardDrive, User } from 'lucide-react';
import { WalletConnect } from './WalletConnect';
import clsx from 'clsx';

function Layout() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/providers', icon: HardDrive, label: 'Providers' },
    { path: '/files', icon: FileText, label: 'Files' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <nav className="w-64 bg-white border-r border-gray-200 px-4 py-6">
        <div className="flex items-center gap-2 px-2 mb-8">
          <FileText className="w-8 h-8 text-purple-600" />
          <h1 className="text-xl font-bold text-gray-900">Alpha AI Storage</h1>
        </div>
        
        <div className="space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-800">
              {navItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
            </h2>
            <WalletConnect />
          </div>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;