import BootstrapClient from '@/components/BootstrapClient';
import ClientProviders from '@/components/ClientProviders';
import "./globals.scss";

export const metadata = { title: "Vestalia Network", description: "Buy Jackal Storage directly from the website." };

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" />
      </head>
      <body className="d-flex flex-column min-vh-100">
        <ClientProviders>
          {children}
          <BootstrapClient />
        </ClientProviders>
      </body>
    </html>
  );
}
