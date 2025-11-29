'use client';

import { WalletProvider } from "@/context/WalletContext";
import { UserProvider } from "@/context/UserContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function ClientProviders({ children }) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <UserProvider>
          <Header />
          <main className="h-100 text-center flex-fill py-3">{children}</main>
          <Footer />
        </UserProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}
