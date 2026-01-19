import './globals.css';
import RegisterSW from './register-sw';
import { ThemeProvider } from '../components/theme-provider';
import { SerwistProvider } from './serwist';

export const metadata = {
  title: 'AuraSafe Gold Tracker',
  description: 'Local-first, encrypted gold tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
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
