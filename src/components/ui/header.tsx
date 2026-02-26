'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Shield, LogOut, User, Bell, ChevronDown, Settings, Activity, AlertCircle, X, Search } from 'lucide-react';

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [systemStatus, setSystemStatus] = useState<{
    active: boolean;
    alertEnabled: boolean;
    recentActivity: boolean;
    lastDetection?: string;
  }>({
    active: true,
    alertEnabled: true,
    recentActivity: false,
  });
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showDropdown || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown, showNotifications]);

  useEffect(() => {
    if (user) {
      loadNotifications();
      loadSystemStatus();
      
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'snake_detections',
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        loadSystemStatus();
      }, 120000);

      return () => clearInterval(interval);
    }
  }, [user]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadUserProfile(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
    setShowDropdown(false);
    router.push('/');
    router.refresh();
  };

  const getUserInitials = () => {
    if (userProfile?.full_name) {
      const names = userProfile.full_name.split(' ');
      if (names.length >= 2) {
        return (names[0][0] + names[1][0]).toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const getUserDisplayName = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const { data: recentDetections, error } = await supabase
        .from('snake_detections')
        .select('id, species, timestamp, risk_level, venomous, confidence, latitude, longitude')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }

      if (recentDetections) {
        const formattedNotifications = recentDetections.map((detection) => ({
          id: detection.id,
          type: 'detection',
          title: detection.species || 'Snake Detected',
          message: detection.venomous 
            ? `Venomous ${detection.species || 'snake'} detected`
            : `Non-venomous ${detection.species || 'snake'} detected`,
          timestamp: detection.timestamp,
          riskLevel: detection.risk_level,
          read: false,
        }));

        setNotifications(formattedNotifications);
        setUnreadCount(formattedNotifications.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleNotificationClick = (notification: any) => {
    setNotifications(prev => 
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    router.push('/detections');
    setShowNotifications(false);
  };

  const formatNotificationTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const loadSystemStatus = async () => {
    try {
      const [settingsRes, lastDetectionRes] = await Promise.all([
        supabase
          .from('system_settings')
          .select('alert_enabled')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('snake_detections')
          .select('timestamp')
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const settings = settingsRes.data;
      const lastDetection = lastDetectionRes.data;

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const hasRecentActivity = lastDetection?.timestamp
        ? new Date(lastDetection.timestamp).getTime() > oneHourAgo
        : false;

      setSystemStatus({
        active: settings?.alert_enabled !== false,
        alertEnabled: settings?.alert_enabled ?? true,
        recentActivity: hasRecentActivity,
        lastDetection: lastDetection?.timestamp,
      });
    } catch (error) {
      console.error('Error loading system status:', error);
    }
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        {/* Search bar - centered like reference image */}
        <div className="hidden md:flex flex-1 justify-center">
          <div className={`relative w-full max-w-sm transition-all duration-200 ${searchFocused ? 'max-w-md' : ''}`}>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search detections, species..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all duration-200"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* System Status Pill */}
          <button
            onClick={() => setShowStatusModal(true)}
            className={`hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
              systemStatus.active && systemStatus.alertEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : systemStatus.alertEnabled
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
            title="System Status"
          >
            <div className="relative">
              <div className={`w-2 h-2 rounded-full ${
                systemStatus.active && systemStatus.alertEnabled ? 'bg-emerald-500' :
                systemStatus.alertEnabled ? 'bg-amber-500' : 'bg-gray-400'
              }`} />
              {systemStatus.active && systemStatus.alertEnabled && (
                <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-50" />
              )}
            </div>
            <span>
              {systemStatus.active && systemStatus.alertEnabled
                ? 'System Active'
                : systemStatus.alertEnabled
                ? 'System Idle'
                : 'Alerts Disabled'}
            </span>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors duration-200"
            >
              <Bell className="h-5 w-5 text-gray-500" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 max-h-96 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-[11px] bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                
                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-400">
                      No notifications
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                            !notification.read ? 'bg-emerald-50/50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {notification.message}
                              </p>
                              {notification.riskLevel && (
                                <span className={`inline-block mt-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                  notification.riskLevel === 'critical' ? 'bg-red-100 text-red-700' :
                                  notification.riskLevel === 'high' ? 'bg-orange-100 text-orange-700' :
                                  notification.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {notification.riskLevel.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-400 ml-2 whitespace-nowrap">
                              {formatNotificationTime(notification.timestamp)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-gray-100">
                    <button
                      onClick={() => {
                        router.push('/detections');
                        setShowNotifications(false);
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium w-full text-center transition-colors"
                    >
                      View all detections
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Admin Link */}
          <Link 
            href="/admin/login" 
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors duration-200 flex items-center"
            title="Admin"
          >
            <Shield className="h-5 w-5 text-gray-500" />
          </Link>

          {/* User */}
          {loading ? (
            <div className="h-8 w-8 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
          ) : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors duration-200"
              >
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-semibold text-xs">
                  {getUserInitials()}
                </div>
                <span className="hidden md:inline-block text-sm font-medium text-gray-700 max-w-[100px] truncate">
                  {getUserDisplayName()}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{getUserDisplayName()}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
                  </div>
                  
                  <div className="py-1">
                    <Link
                      href="/settings"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="h-4 w-4 mr-3 text-gray-400" />
                      Settings
                    </Link>
                    
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link 
              href="/login" 
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all duration-200 font-medium text-sm shadow-sm active:scale-95"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {/* System Status Modal */}
      {showStatusModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/10"
          onClick={() => setShowStatusModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    systemStatus.active && systemStatus.alertEnabled
                      ? 'bg-emerald-100'
                      : systemStatus.alertEnabled
                      ? 'bg-amber-100'
                      : 'bg-gray-100'
                  }`}>
                    <Activity className={`h-5 w-5 ${
                      systemStatus.active && systemStatus.alertEnabled
                        ? 'text-emerald-600'
                        : systemStatus.alertEnabled
                        ? 'text-amber-600'
                        : 'text-gray-600'
                    } ${systemStatus.recentActivity ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {systemStatus.active && systemStatus.alertEnabled
                        ? 'System Active'
                        : systemStatus.alertEnabled
                        ? 'System Idle'
                        : 'Alerts Disabled'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {systemStatus.alertEnabled
                        ? 'Detection system is operational'
                        : 'Alerts are currently disabled'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Alert System</span>
                  <span className={`font-medium ${
                    systemStatus.alertEnabled ? 'text-emerald-600' : 'text-gray-400'
                  }`}>
                    {systemStatus.alertEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Recent Activity</span>
                  <span className={`font-medium ${
                    systemStatus.recentActivity ? 'text-emerald-600' : 'text-gray-400'
                  }`}>
                    {systemStatus.recentActivity ? 'Active' : 'No recent detections'}
                  </span>
                </div>

                {systemStatus.lastDetection && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Last Detection</span>
                    <span className="text-gray-900 font-medium">
                      {formatNotificationTime(systemStatus.lastDetection)}
                    </span>
                  </div>
                )}
              </div>

              {!systemStatus.alertEnabled && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800">
                      Alerts are disabled. Enable them in Admin Settings to receive notifications.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
