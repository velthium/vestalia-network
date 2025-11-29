import BootstrapClient from '@/components/BootstrapClient';
import { WalletProvider } from "@/context/WalletContext";
import { UserProvider } from "@/context/UserContext";
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import "./globals.scss";

export const metadata = { title: "Vestalia Network", description: "Buy Jackal Storage directly from the website." };

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" />
      </head>
      <body className="d-flex flex-column min-vh-100">
        <WalletProvider>
          <UserProvider>
            <Header />
            <main className="h-100 text-center flex-fill py-3">{children}<BootstrapClient /></main>
            <Footer />
          </UserProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
