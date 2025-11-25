'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Shield, LogOut, User, Bell, ChevronDown, Settings, Activity, AlertCircle, X } from 'lucide-react';

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    checkUser();
    
    // Listen for auth changes
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

  // Close dropdown when clicking outside
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

  // Load notifications and system status when user is logged in
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadSystemStatus();
      
      // Set up realtime subscription for new notifications
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
            loadSystemStatus();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Poll system status periodically
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        loadSystemStatus();
      }, 30000); // Check every 30 seconds

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
      // Get recent detections (last 10, ordered by timestamp)
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
        // Format as notifications
        const formattedNotifications = recentDetections.map((detection) => ({
          id: detection.id,
          type: 'detection',
          title: detection.species || 'Snake Detected',
          message: detection.venomous 
            ? `Venomous ${detection.species || 'snake'} detected`
            : `Non-venomous ${detection.species || 'snake'} detected`,
          timestamp: detection.timestamp,
          riskLevel: detection.risk_level,
          read: false, // You can add a read status field later
        }));

        setNotifications(formattedNotifications);
        setUnreadCount(formattedNotifications.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleNotificationClick = (notification: any) => {
    // Mark as read (you can implement this with a database update)
    setNotifications(prev => 
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    // Navigate to detections page
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
      // Check system settings for alert status
      const { data: settings } = await supabase
        .from('system_settings')
        .select('alert_enabled')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Check for recent activity (detections in last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentDetections } = await supabase
        .from('snake_detections')
        .select('timestamp')
        .gte('timestamp', oneHourAgo)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get last detection time
      const { data: lastDetection } = await supabase
        .from('snake_detections')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSystemStatus({
        active: settings?.alert_enabled !== false,
        alertEnabled: settings?.alert_enabled ?? true,
        recentActivity: !!recentDetections,
        lastDetection: lastDetection?.timestamp,
      });
    } catch (error) {
      console.error('Error loading system status:', error);
    }
  };

  return (
    <header className="bg-gradient-to-r from-green-800 to-green-900 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3">
          <span className="text-2xl font-bold">SnakeGuard</span>
        </Link>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowStatusModal(true)}
            className={`hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              systemStatus.active && systemStatus.alertEnabled
                ? 'bg-green-700 hover:bg-green-600'
                : systemStatus.alertEnabled
                ? 'bg-yellow-600 hover:bg-yellow-500'
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
            title="System Status"
          >
            <Activity className={`h-4 w-4 ${systemStatus.recentActivity ? 'animate-pulse' : ''}`} />
            <span>
              {systemStatus.active && systemStatus.alertEnabled
                ? 'System Active'
                : systemStatus.alertEnabled
                ? 'System Idle'
                : 'Alerts Disabled'}
            </span>
          </button>
          
          {loading ? (
            <div className="h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-2 px-3 py-2 rounded-full hover:bg-green-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-white text-green-800 flex items-center justify-center font-semibold text-sm">
                  {getUserInitials()}
                </div>
                <span className="hidden md:inline-block text-sm font-medium max-w-[120px] truncate">
                  {getUserDisplayName()}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-semibold text-gray-900">{getUserDisplayName()}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  
                  <Link
                    href="/settings"
                    onClick={() => setShowDropdown(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Settings className="h-4 w-4 mr-3" />
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
              )}
            </div>
          ) : (
            <Link 
              href="/login" 
              className="px-5 py-2 bg-white text-green-800 rounded-full hover:bg-gray-100 transition-colors font-medium shadow-sm"
            >
              Login
            </Link>
          )}
          
          {/* Admin Login Link */}
          <Link 
            href="/admin/login" 
            className="p-2 rounded-full hover:bg-green-700 transition-colors flex items-center"
            title="Admin"
          >
            <Shield className="h-6 w-6" />
            <span className="hidden md:inline-block ml-1">Admin</span>
          </Link>
          
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-full hover:bg-green-700 transition-colors relative"
            >
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                
                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      No notifications
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                            !notification.read ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              {notification.riskLevel && (
                                <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${
                                  notification.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                                  notification.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                                  notification.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {notification.riskLevel.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                              {formatNotificationTime(notification.timestamp)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-200">
                    <button
                      onClick={() => {
                        router.push('/detections');
                        setShowNotifications(false);
                      }}
                      className="text-xs text-green-600 hover:text-green-700 font-medium w-full text-center"
                    >
                      View all detections
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Status Modal */}
      {showStatusModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setShowStatusModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    systemStatus.active && systemStatus.alertEnabled
                      ? 'bg-green-100'
                      : systemStatus.alertEnabled
                      ? 'bg-yellow-100'
                      : 'bg-gray-100'
                  }`}>
                    <Activity className={`h-5 w-5 ${
                      systemStatus.active && systemStatus.alertEnabled
                        ? 'text-green-600'
                        : systemStatus.alertEnabled
                        ? 'text-yellow-600'
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
                    <p className="text-xs text-gray-500">
                      {systemStatus.alertEnabled
                        ? 'Detection system is operational'
                        : 'Alerts are currently disabled'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Alert System</span>
                  <span className={`font-medium ${
                    systemStatus.alertEnabled ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {systemStatus.alertEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Recent Activity</span>
                  <span className={`font-medium ${
                    systemStatus.recentActivity ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {systemStatus.recentActivity ? 'Active' : 'No recent detections'}
                  </span>
                </div>

                {systemStatus.lastDetection && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Last Detection</span>
                    <span className="text-gray-900 font-medium">
                      {formatNotificationTime(systemStatus.lastDetection)}
                    </span>
                  </div>
                )}
              </div>

              {!systemStatus.alertEnabled && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-800">
                      Alerts are disabled. Enable them in Admin Settings to receive notifications.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-800 transition-colors"
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
