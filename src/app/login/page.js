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
  const [status, setStatus] = useState("");

  const { connectWallet, client, connected } = useWallet();
  const { setUserName } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (connected) {
      router.push("/vault");
    }
  }, [connected, router]);

  const handleLoginClick = async () => {
    try {
      setIsLoading(true);
      setStatus("Connecting...");

      const success = await connectWallet();
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
      console.error("Error during connection:", error);
      setStatus("Connection failed!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container text-center">
      <PageTitle title="Connect your Wallet" />
      <button className="btn mt-4 bg-purple d-flex align-items-center justify-content-center gap-3 mx-auto px-4 py-2" onClick={handleLoginClick} disabled={isLoading} aria-label="Connect with Keplr wallet">
        {isLoading ? <ClipLoader size={24} color="#000000" /> : <Image src="/images/Keplr.svg" alt="Keplr logo" width={40} height={40} className="rounded" loading="eager" />}
        <span className="fw-semibold fs-5 my-auto">{isLoading ? "Connecting..." : "Keplr Wallet"}</span>
      </button>
      {status && <p className={`mt-3 ${status.toLowerCase().match(/success|connected|connecting/) ? 'text-success' : 'text-danger'}`}>{status}</p>}
    </div>
  );
}
