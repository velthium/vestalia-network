'use client';

import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = (props) => {
  const [authData, setAuthData] = useState({
    desmosProfile: null,
    walletSigner: null,
  });

  useEffect(() => {
    const desmosProfile = JSON.parse(sessionStorage.getItem('desmosProfile'));
    const walletSigner = JSON.parse(sessionStorage.getItem('walletSigner'));

    if (desmosProfile) {
      setAuthData((prevData) => ({
        ...prevData,
        desmosProfile
      }));
    }

    if (walletSigner) {
      setAuthData((prevData) => ({
        ...prevData,
        walletSigner
      }));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ authData, setAuthData }}>
      {props.children}
    </AuthContext.Provider>
  );
};
