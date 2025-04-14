import Link from 'next/link';

export default function Sidebar() {
  const navItems = [
    { name: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', href: '/' },
    { name: 'Detections', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', href: '/detections' },
    { name: 'Map View', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', href: '/map' },
    { name: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', href: '/settings' },
  ];

  return (
    <aside className="bg-white shadow-md w-16 md:w-64 h-screen flex-shrink-0 flex flex-col">
      {/* Navigation section */}
      <div className="flex-grow overflow-y-auto">
        <nav className="mt-10 px-2">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.name}>
                <Link href={item.href} className="flex items-center p-3 text-gray-700 hover:bg-green-50 rounded-lg transition-colors group">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500 group-hover:text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span className="hidden md:inline-block ml-3">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* System status section - fixed at bottom */}
      <div className="flex-shrink-0 w-full px-2 pb-4 mt-4">
        <div className="hidden md:block p-4 bg-green-50 rounded-lg">
          <h4 className="text-sm font-medium text-green-800">System Status</h4>
          <div className="mt-2 flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-xs text-green-700">Online - Operating Normally</span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Last check: 2 minutes ago
          </div>
        </div>
        
        {/* Mobile version of system status */}
        <div className="md:hidden flex flex-col items-center p-2">
          <div className="w-3 h-3 bg-green-500 rounded-full mb-1"></div>
          <span className="text-xs text-green-700 text-center">Online</span>
        </div>
      </div>
    </aside>
  );
}