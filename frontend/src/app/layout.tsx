import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { QueryProvider } from '@/components/providers';
import { KeyboardShortcutsProvider } from '@/lib/keyboard-shortcuts';
import { ThemeProvider } from '@/lib/theme-context';

export const metadata: Metadata = {
  title: 'Trackr ',
  description: 'Internal issue tracking for your team',
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <QueryProvider>
          <ThemeProvider>
            <KeyboardShortcutsProvider>
              <AuthProvider>{children}</AuthProvider>
            </KeyboardShortcutsProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
