import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const grotesk = localFont({
  src: './fonts/schibsted-grotesk-latin-wght-normal.woff2',
  variable: '--font-grotesk',
  weight: '400 900',
  display: 'swap',
});

const martian = localFont({
  src: './fonts/martian-mono-latin-wght-normal.woff2',
  variable: '--font-martian',
  weight: '100 800',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Gamebase', template: '%s · Gamebase' },
  description: 'Board games with friends.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0e0e10',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${grotesk.variable} ${martian.variable}`}>
      <body>{children}</body>
    </html>
  );
}
