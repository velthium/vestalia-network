"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useWallet } from "@/context/WalletContext";
import { useTheme } from "@/context/ThemeContext";

export default function Header() {
  const { userName, setUserName } = useUser();
  const { connected, disconnectWallet } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const [keplrInfo, setKeplrInfo] = useState({ name: null, address: null });

  useEffect(() => {
    (async () => {
      if (!connected || !window.keplr) return;
      try {
        const key = await window.keplr.getKey("jackal-1");
        setKeplrInfo({ name: key.name, address: key.bech32Address });
      } catch (err) { console.warn("Could not load Keplr key:", err); }
    })();
  }, [connected]);

  const displayName = userName || keplrInfo.name || (keplrInfo.address ? keplrInfo.address.slice(0, 6) + "..." + keplrInfo.address.slice(-4) : "Connected");

  const handleLogout = () => {
    setUserName(null);
    localStorage.removeItem("userName");
    try { disconnectWallet(); } catch (e) { console.warn('disconnectWallet failed:', e); }
    try { window.location.href = "/login"; } catch (e) { }
  };

  return (
    <header>
      <nav className="navbar navbar-expand-lg p-0">
        <div className="container-fluid">
          <Link className="navbar-brand d-flex align-items-center" href="/">
            <Image src="/images/Logo.png" alt="Vestalia Logo" width={50} height={50} className="rounded" priority />
            <span className="fw-bolder ms-2">Vestalia Network</span>
          </Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarText"><span className="navbar-toggler-icon"></span></button>
          <div className="collapse navbar-collapse" id="navbarText">
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
              {connected && <li className="nav-item"><Link className="nav-link active" href="/vault">📦 Vault</Link></li>}
              <li className="nav-item"><Link className="nav-link" href="/pricing">Pricing</Link></li>
              <li className="nav-item"><Link className="nav-link" href="/faq">FAQ</Link></li>
              <li className="nav-item ms-3 d-flex align-items-center">
                <button 
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center" 
                  onClick={toggleTheme}
                  title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                  style={{ width: '38px', height: '38px' }}
                >
                  <i className={`bi ${theme === 'light' ? 'bi-moon-stars-fill' : 'bi-sun-fill'}`}></i>
                </button>
              </li>
              <li className="nav-item ms-3">
                {connected ? (
                  <div className="d-flex align-items-center gap-2">
                    <span className="nav-link text-success">👤 {displayName}</span>
                    <button className="btn btn-sm btn-outline-danger" onClick={handleLogout}>Logout</button>
                  </div>
                ) : <Link className="nav-link" href="/login">Login</Link>}
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}
