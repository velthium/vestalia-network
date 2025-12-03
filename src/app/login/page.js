// src/app/login/page.js
"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import PageTitle from "@/components/PageTitle";
import { ClipLoader } from "react-spinners";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(null);
  const [status, setStatus] = useState("");

  const { connectWallet, client, connected } = useWallet();
  const { setUserName } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (connected) {
      router.push("/vault");
    }
  }, [connected, router]);

  const handleLoginClick = async (walletType) => {
    try {
      setIsLoading(true);
      setConnectingWallet(walletType);
      setStatus(`Connecting to ${walletType === 'leap' ? 'Leap' : 'Keplr'}...`);

      const success = await connectWallet(walletType);
      if (!success) {
        setStatus("Connection failed!");
        return;
      }

      const userName = client?.details?.name;
      if (userName) {
        setUserName(userName);
        localStorage.setItem("userName", userName);
      }

      setStatus("Connected successfully!");
      router.push("/vault");
    } catch (error) {
      setStatus("Connection failed!");
    } finally {
      setIsLoading(false);
      setConnectingWallet(null);
    }
  };

  return (
    <div className="container text-center">
      <PageTitle title="Connect your Wallet" />
      <div className="d-flex flex-column gap-3 align-items-center mt-4">
        <button 
          className="btn d-flex align-items-center justify-content-center gap-3 px-4 py-3" 
          style={{ 
            minWidth: '300px',
            background: 'linear-gradient(135deg, #E0CCFF 0%, #C8B6FF 100%)',
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(123, 97, 255, 0.2)',
            transition: 'all 0.2s ease'
          }} 
          onClick={() => handleLoginClick('keplr')} 
          disabled={isLoading} 
          aria-label="Connect with Keplr wallet"
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          {connectingWallet === 'keplr' ? <ClipLoader size={24} color="#000000" /> : <Image src="/images/Keplr.svg" alt="Keplr logo" width={40} height={40} className="rounded" loading="eager" />}
          <span className="fw-semibold fs-5 my-auto" style={{ color: '#1a1625' }}>{connectingWallet === 'keplr' ? "Connecting..." : "Keplr Wallet"}</span>
        </button>

        <button 
          className="btn d-flex align-items-center justify-content-center gap-3 px-4 py-3" 
          style={{ 
            minWidth: '300px',
            background: 'linear-gradient(135deg, #E0CCFF 0%, #C8B6FF 100%)',
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(123, 97, 255, 0.2)',
            transition: 'all 0.2s ease'
          }} 
          onClick={() => handleLoginClick('leap')} 
          disabled={isLoading} 
          aria-label="Connect with Leap wallet"
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          {connectingWallet === 'leap' ? <ClipLoader size={24} color="#000000" /> : <Image src="/images/Leap.png" alt="Leap logo" width={40} height={40} className="rounded" loading="eager" />}
          <span className="fw-semibold fs-5 my-auto" style={{ color: '#1a1625' }}>{connectingWallet === 'leap' ? "Connecting..." : "Leap Wallet"}</span>
        </button>
      </div>
      {status && <p className={`mt-3 ${status.toLowerCase().match(/success|connected|connecting/) ? 'text-success' : 'text-danger'}`}>{status}</p>}
    </div>
  );
}
