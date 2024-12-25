"use client";

import React, { useState } from 'react';
import { initializeJackal } from '@/lib/jackalClient'; // Adaptez le chemin à votre projet

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
    <div>
      <h1>Login</h1>
      <button onClick={handleLoginClick}>Connect to Jackal</button>
      {status && <p>{status}</p>}
    </div>
  );
};

export default Login;
