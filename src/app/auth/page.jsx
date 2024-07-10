'use client';

import PageTitle from "@/components/Title";
import React from "react";
import { useRouter } from 'next/navigation';

function AuthPage() {
  const router = useRouter();

  const handleClick = () => {
    router.push("/auth/keplr");
  };

  return (
    <div className="container">
      <PageTitle title="Connect your Wallet" />
      <button
        type="button"
        className="btn bg-white border shadow-sm mw-25 w-25 mx-auto my-5 d-flex"
        onClick={handleClick}>
        <img
          src="/images/Keplr.svg"
          alt="Keplr Logo" />
        <p className="fw-semibold fs-4 my-auto ms-3">Keplr</p>
      </button>
    </div>
  );
}

export default AuthPage;
