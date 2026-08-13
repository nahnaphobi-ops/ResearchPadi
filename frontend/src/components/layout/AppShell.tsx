import type { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

export default function AppShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col app-shell">
      <Navbar />
      <main className={`flex-1 w-full px-5 py-10 lg:px-8 ${wide ? 'max-w-6xl' : 'max-w-5xl'} mx-auto`}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
