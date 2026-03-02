'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    {
      name: 'Dashboard',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      href: '/',
    },
    {
      name: 'Detections',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      icon2: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      href: '/detections',
    },
    {
      name: 'Map View',
      icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
      href: '/map',
      indicator: true,
    },
    {
      name: 'Responders',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      href: '/responders',
    },
    {
      name: 'Live Tracking',
      icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
      href: '/live-test',
    },
    {
      name: 'Path Lab',
      icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
      href: '/path-test',
    },
    {
      name: 'Settings',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      icon2: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      href: '/settings',
    },
  ];

  const isActive = (href: string) => {
    if (!mounted) return false;
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  return (
    <aside className="bg-white w-16 md:w-56 h-screen flex-shrink-0 flex flex-col shadow-sm">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <span className="hidden md:block text-base font-bold text-gray-900">
          SnakeGuard
        </span>
      </div>

      {/* Navigation */}
      <div className="flex-grow overflow-y-auto py-2 px-2">
        <nav>
          <ul className="space-y-0.5">
            {navItems.map((item, index) => {
              const active = isActive(item.href);
              return (
                <li
                  key={item.name}
                  className="sidebar-nav-item"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <Link
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-200 group
                      ${active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 flex-shrink-0 ${active ? 'text-emerald-700' : 'text-gray-400 group-hover:text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      {item.icon2 && <path strokeLinecap="round" strokeLinejoin="round" d={item.icon2} />}
                    </svg>
                    <span className="hidden md:block truncate">{item.name}</span>
                    {/* Green indicator dot (e.g. Map View) */}
                    {item.indicator && (
                      <span className="hidden md:inline-block w-2 h-2 bg-emerald-500 rounded-full ml-auto flex-shrink-0" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* System Status section at bottom */}
      <div className="flex-shrink-0 w-full px-3 pb-4 mt-auto">
        <div className="hidden md:flex items-center gap-2 p-3 bg-red-50 rounded-lg">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0" />
          <span className="text-xs font-medium text-red-700">System Status</span>
        </div>

        {/* Mobile system status */}
        <div className="md:hidden flex flex-col items-center p-2">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full mb-1" />
          <span className="text-[10px] text-emerald-700 text-center">Online</span>
        </div>
      </div>
    </aside>
  );
}