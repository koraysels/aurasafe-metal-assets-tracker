import './globals.css';
import RegisterSW from './register-sw';
import { ThemeProvider } from '../components/theme-provider';
import { SerwistProvider } from './serwist';

export const metadata = {
  title: 'AuraSafe - Gold & Silver Tracker',
  description: 'Secure, local-first encrypted gold and silver investment tracker. Track your precious metals portfolio with complete privacy and offline support.',
  keywords: 'gold tracker, silver tracker, precious metals, portfolio tracker, encrypted, privacy, offline-first, gold investment, silver investment',
  authors: [{ name: 'Koray' }],
  creator: 'Koray',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AuraSafe',
  },
  openGraph: {
    type: 'website',
    title: 'AuraSafe - Gold & Silver Tracker',
    description: 'Secure, local-first encrypted gold and silver investment tracker',
    siteName: 'AuraSafe',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0ea5e9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <SerwistProvider swUrl="/serwist/sw.js">
            {children}
            <RegisterSW />
          </SerwistProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
