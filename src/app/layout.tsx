import './globals.css';
import RegisterSW from './register-sw';

export const metadata = {
  title: 'AuraSafe Gold Tracker',
  description: 'Local-first, encrypted gold tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="min-h-screen bg-gray-950 text-gray-100">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
