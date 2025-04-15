import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-gradient-to-r from-green-800 to-green-900 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3">
          {/* <Image
            src="/snake-icon.svg"
            alt="SnakeGuard Logo"
            width={40}
            height={40}
            className="w-10 h-10"
          /> */}
          <span className="text-2xl font-bold">SnakeGuard</span>
        </Link>
        
        <div className="flex items-center space-x-4">
          <span className="hidden md:inline-block px-4 py-2 bg-green-700 rounded-full text-sm font-medium">
            System Active
          </span>
          <div className="relative">
            <button className="p-2 rounded-full hover:bg-green-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </div>
        </div>
      </div>
    </header>
  );
}