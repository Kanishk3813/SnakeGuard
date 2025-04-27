import './globals.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import ChatBot from '@/components/ui/chatbot';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SnakeGuard Dashboard',
  description: 'Real-time snake detection and monitoring system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <ChatBot />
      </body>
    </html>
  );
}