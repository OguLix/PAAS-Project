import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Nunito, Outfit } from 'next/font/google';
import { MockNotice } from '@/components/layout/mock-notice';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OguLix PaaS',
  description: 'Control plane for the OguLix PaaS',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${nunito.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <MockNotice />
        {children}
      </body>
    </html>
  );
}
