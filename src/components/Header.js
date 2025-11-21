"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useWallet } from "@/context/WalletContext";

export default function Header() {
  const { userName, setUserName } = useUser();
  const { connected, setConnected } = useWallet();

  const [keplrName, setKeplrName] = useState(null);
  const [keplrAddress, setKeplrAddress] = useState(null);

  // Load Keplr wallet name/address
  useEffect(() => {
    const loadKeplrInfo = async () => {
      try {
        if (!connected || !window.keplr) return;

        const key = await window.keplr.getKey("jackal-1");

        setKeplrName(key.name);
        setKeplrAddress(key.bech32Address);
      } catch (err) {
        console.warn("Could not load Keplr key:", err);
      }
    };

    loadKeplrInfo();
  }, [connected]);

  const shortAddr = keplrAddress
    ? keplrAddress.slice(0, 6) + "..." + keplrAddress.slice(-4)
    : null;

  const displayName = userName || keplrName || shortAddr || "Connected";

  const handleLogout = () => {
    setUserName(null);
    localStorage.removeItem("userName");

    setConnected(false);

    window.location.href = "/login";
  };

  return (
    <header>
      <nav className="navbar navbar-expand-lg p-0">
        <div className="container-fluid">
          <Link className="navbar-brand d-flex align-items-center" href="/">
            <Image
              src="/images/Logo.png"
              alt="Vestalia Logo"
              width={50}
              height={50}
              className="rounded"
              priority
            />
            <span className="fw-bolder ms-2">Vestalia Network</span>
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarText"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navbarText">
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0">

              {connected && (
                <li className="nav-item">
                  <Link className="nav-link active" href="/vault">
                    📦 Vault
                  </Link>
                </li>
              )}

              <li className="nav-item">
                <Link className="nav-link" href="/pricing">Pricing</Link>
              </li>

              <li className="nav-item">
                <Link className="nav-link" href="/faq">FAQ</Link>
              </li>

              <li className="nav-item ms-3">
                {connected ? (
                  <div className="d-flex align-items-center gap-2">
                    <span className="nav-link text-success">
                      👤 {displayName}
                    </span>

                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <Link className="nav-link" href="/login">Login</Link>
                )}
              </li>

            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}
