import ReactQueryProvider from '@/contexts/ReactQueryProvider';
import BootstrapClient from "@/components/BootstrapClient";
import { AuthProvider } from "@/contexts/Auth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PropTypes from "prop-types";
import "@/styles.scss";

export const metadata = {
  title: "Vestalia Network",
  description: "Decentralized forums",
  icons: {
    icon: '/images/favicon.ico',
  },
};

RootLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ReactQueryProvider>
            <Header />
            <main>
              {children}
            </main>
            <BootstrapClient />
            <Footer />
          </ReactQueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}