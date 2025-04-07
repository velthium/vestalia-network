"use client";

import { initializeJackal } from '@/lib/jackalClient';
import PageTitle from '@/components/PageTitle';
import React, { useState } from 'react';
import Image from 'next/image';

const Login = () => {
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleLoginClick = async () => {
    try {
      setStatus('Connecting...');
      const { client, storage } = await initializeJackal();
      setStatus('Connected successfully!');
      console.debug('Jackal client:', client);
      console.log('Storage:', storage);
    } catch (error) {
      setStatus('Connection failed!');
      console.error('Error during connection:', error);
    } finally {
      setIsLoading(false);
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
        <p className="fw-semibold fs-4 my-auto ms-3"><span>{isLoading ? 'Connecting...' : 'Keplr Wallet'}</span></p></button>
        {status && (
          <p className={`mt-3 ${status.includes('success') ? 'text-success' : 'text-danger'}`}>
            {status}
          </p>
        )}
    </div>
  );
};

export default Login;
