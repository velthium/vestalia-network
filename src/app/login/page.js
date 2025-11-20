'use client';

import { initializeJackal } from '@/lib/jackalClient';
import { useUser } from '@/context/UserContext';
import PageTitle from '@/components/PageTitle';
import { ClipLoader } from 'react-spinners';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import Image from 'next/image';

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const { setUserName } = useUser();
  const router = useRouter();

  const handleLoginClick = async () => {
    try {
      setIsLoading(true);
      setStatus('Connecting...');

      const { client, storage } = await initializeJackal();

      const userName = client?.details?.name;

      if (userName) {
        setUserName(userName);
        localStorage.setItem('userName', userName);
        setStatus('Connected successfully!');

        router.push('/pricing');
      } else {
        setStatus('Connected, but no user name found.');
      }

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
    <div className="container text-center">
      <PageTitle title="Connect your Wallet" />

      <button
        className="btn mt-4 bg-purple d-flex align-items-center justify-content-center gap-3 mx-auto px-4 py-2"
        onClick={handleLoginClick}
        disabled={isLoading}
        aria-label="Connect with Keplr wallet"
      >
        {isLoading ? (
          <ClipLoader size={24} color="#000000" />
        ) : (
          <Image
            src="/images/Keplr.svg"
            alt="Logo Vestalia Network"
            width={40}
            height={40}
            className="rounded"
            loading="eager"
          />
        )}
        <span className="fw-semibold fs-5 my-auto">
          {isLoading ? 'Connecting...' : 'Keplr Wallet'}
        </span>
      </button>

      {status && status !== 'Connecting...' && (
        <div className="d-flex align-items-center gap-3 justify-content-center">
          <p className={`mt-3 ${status.includes('success') ? 'text-success' : 'text-danger'}`}>
            {status}
          </p>
        </div>
      )}
    </div>
  );
};

export default Login;
