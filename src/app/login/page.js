"use client";

import { initializeJackal } from '@/lib/jackalClient';
import PageTitle from '@/components/PageTitle';
import React, { useState } from 'react';
import Image from 'next/image';

const Login = () => {
  const [status, setStatus] = useState('');
  
  const handleLoginClick = async () => {
    try {
      setStatus('Connecting...');
      const { client, storage } = await initializeJackal();
      setStatus('Connected successfully!');
      console.log('Client:', client);
      console.log('Storage:', storage);
    } catch (error) {
      setStatus('Connection failed!');
      console.error('Error during connection:', error);
    }
  };

  return (
    <div className="container">
      <PageTitle title="Connect your Wallet" />
      <button className="btn mt-4 bg-warning d-flex align-items-center mx-auto" onClick={handleLoginClick}>
        <Image
        src="/images/Keplr.svg"
        alt="Logo Vestalia Network"
        width={50}
        height={50}
        className="rounded"
        loading="eager"/>
        <p className="fw-semibold fs-4 my-auto ms-3">Keplr Wallet</p></button>
      {status && <p>{status}</p>}
    </div>
  );
};

export default Login;
