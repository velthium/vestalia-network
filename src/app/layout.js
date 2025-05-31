import BootstrapClient from '@/components/BootstrapClient';
import { Geist, Geist_Mono } from "next/font/google";
import { UserProvider } from '@/context/UserContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';


import "./globals.scss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Vestalia Network",
  description: "Buy Jackal Storage directly from the website.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <UserProvider>
          <Header />
          <main className="h-100 text-center py-3">
            {children}
            <BootstrapClient />
          </main>
          <Footer />
        </UserProvider>
      </body>
    </html>
  );
}
