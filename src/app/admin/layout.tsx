// src/app/admin/layout.tsx

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  AlertTriangle, BarChart3, LogOut, Map, Settings, 
  Users, Database, Clipboard, Home, Menu, X, Activity
} from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return router.push('/admin/login');
      }
      
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      if (adminError || !adminData) {
        await supabase.auth.signOut();
        return router.push('/admin/login');
      }
      
      setUser(session.user);
      setLoading(false);
    };
    
    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: BarChart3 },
    { name: 'Detections', href: '/admin/detections', icon: AlertTriangle },
    { name: 'Map', href: '/admin/map', icon: Map },
    { name: 'Pipeline', href: '/admin/pipeline', icon: Activity },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div>
      {/* Mobile menu */}
      <div className="lg:hidden">
        <div className="fixed inset-0 flex z-40">
          <div
            className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ease-in-out duration-300 ${
              mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          <div
            className={`relative flex-1 flex flex-col max-w-xs w-full bg-white transform transition-transform ease-in-out duration-300 ${
              mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4">
                <span className="text-xl font-bold text-green-600">Snake Admin</span>
              </div>
              <nav className="mt-5 px-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                        isActive 
                          ? 'bg-green-100 text-green-900' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <item.icon
                        className={`mr-4 flex-shrink-0 h-6 w-6 ${
                          isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-500'
                        }`}
                      />
                      {item.name}
                    </Link>
                  );
                })}
                <Link 
                  href="/"
                  className="group flex items-center px-2 py-2 text-base font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  <Home className="mr-4 flex-shrink-0 h-6 w-6 text-gray-400 group-hover:text-gray-500" />
                  Main Site
                </Link>
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
              <button
                onClick={handleSignOut}
                className="flex-shrink-0 group block w-full"
              >
                <div className="flex items-center">
                  <div>
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-base font-medium text-gray-700 group-hover:text-gray-900">
                      {user.email}
                    </p>
                    <div className="flex items-center text-sm font-medium text-gray-500 group-hover:text-gray-700">
                      <LogOut className="mr-1 h-4 w-4" />
                      <span>Log out</span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <span className="text-xl font-bold text-green-600">Snake Admin</span>
            </div>
            <nav className="mt-5 flex-1 px-2 bg-white space-y-1" aria-label="Sidebar">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      isActive 
                        ? 'bg-green-100 text-green-900' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 flex-shrink-0 h-6 w-6 ${
                        isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
              <Link 
                href="/"
                className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                <Home className="mr-3 flex-shrink-0 h-6 w-6 text-gray-400 group-hover:text-gray-500" />
                Main Site
              </Link>
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <button
              onClick={handleSignOut}
              className="flex-shrink-0 w-full group block"
            >
              <div className="flex items-center">
                <div>
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-green-500">
                    <span className="text-lg font-medium leading-none text-white">
                      {user.email?.charAt(0).toUpperCase()}
                    </span>
                  </span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate max-w-[164px]">
                    {user.email}
                  </p>
                  <div className="flex items-center text-xs font-medium text-gray-500 group-hover:text-gray-700">
                    <LogOut className="mr-1 h-3 w-3" />
                    <span>Log out</span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
      
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top navbar */}
        <div className="sticky top-0 z-10 bg-white pl-1 pt-1 sm:pl-3 sm:pt-3 lg:hidden">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" />
          </button>
        </div>
        
        <main className="flex-1 bg-gray-50">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}