import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { QueryProvider } from '@/components/providers';
import { KeyboardShortcutsProvider } from '@/lib/keyboard-shortcuts';

export const metadata: Metadata = {
  title: 'Trackr — Issue Tracker',
  description: 'Internal issue tracking for your team',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <KeyboardShortcutsProvider>
            <AuthProvider>{children}</AuthProvider>
          </KeyboardShortcutsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
