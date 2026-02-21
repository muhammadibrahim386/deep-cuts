import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'deep-cuts',
  description: 'Media intelligence — search, explore, and connect ideas across your favorite shows.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-[var(--border)] px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight">
              deep-cuts
            </h1>
            <nav className="flex gap-6 text-sm text-[var(--text-secondary)]">
              <a href="/" className="hover:text-[var(--text-primary)] transition">Search</a>
              <a href="/threads" className="hover:text-[var(--text-primary)] transition">Threads</a>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
