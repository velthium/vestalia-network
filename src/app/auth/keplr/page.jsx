'use client';

import React, { useState, useContext, useEffect } from "react";
import GetProfile from "@/utils/Desmos/getProfile";
import Keplr from "@/utils/Wallet/Keplr";
import ErrorAlert from "@/components/Alert/Error";
import PageTitle from "@/components/Title";
import { AuthContext } from "@/contexts/Auth";
import { useRouter } from 'next/navigation';

function KeplrPage() {
  const { setAuthData } = useContext(AuthContext);
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleClickPreviousPage = (event) => {
    event.preventDefault();
    router.push("/auth");
  };

  const handleClick = () => {
    handleClickKeplr();
  };

  useEffect(() => {
    window.addEventListener("keplr_keystorechange", handleClick);

    return () => {
      window.removeEventListener("keplr_keystorechange", handleClick);
    };
  }, []);

  // Fonction pour nettoyer les références circulaires de keplrData
  const cleanKeplrData = (data) => {
    return {
      accountData: data.signer.accountData,
      // Ajoutez ici d'autres propriétés nécessaires
    };
  };

  async function handleClickKeplr() {
    try {
      const keplrData = await Keplr();

      try {
        const desmosProfile = await GetProfile(keplrData.signer.accountData.address);

        // Utilisation de la fonction cleanKeplrData pour préparer l'objet
        const cleanedKeplrData = cleanKeplrData(keplrData);

        sessionStorage.setItem("walletSigner", JSON.stringify(cleanedKeplrData));
        sessionStorage.setItem("desmosProfile", JSON.stringify(desmosProfile));

        const newAuthData = {
          desmosProfile,
          walletSigner: cleanedKeplrData,
        };
        setAuthData(newAuthData);

        router.push("/");
      } catch (error) {
        console.error("Error in GetProfile: ", error);
        router.push("/profile");
      }
    } catch (error) {
      console.error("Error in Keplr: ", error);
      setError(error);
    }
  }

  return (
    <div className="container">
      <PageTitle title="Keplr Wallet" />
      <div className="d-grid gap-5">
        <button
          type="button"
          className="btn bg-light-green mw-25 rounded-5 mx-auto my-5 p-4"
          onClick={handleClickKeplr}>
          <img
            className="m-3"
            src="/images/Keplr.svg"
            alt="Keplr Logo"
            height="122"
            width="163" />
          <p className="m-auto w-75 bg-purple text-dark rounded h6 py-2">Connect</p>
        </button>
        <a
          className="d-flex w-25 text-start text-decoration-none text-dark"
          href=""
          onClick={handleClickPreviousPage}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            className="bi my-auto bi-caret-left-fill"
            viewBox="0 0 16 16">
          <path d="m3.86 8.753 5.482 4.796c.646.566 1.658.106 1.658-.753V3.204a1 1 0 0 0-1.659-.753l-5.48 4.796a1 1 0 0 0 0 1.506z"/>
          </svg>
          <p className="my-auto">Back</p>
        </a>
      </div>
      {error && <ErrorAlert error={error} />}
    </div>
  );
}

export default KeplrPage;
