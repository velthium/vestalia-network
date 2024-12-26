'use client';

import { initializeJackal } from '@/lib/jackalClient';
import PageTitle from '@/components/PageTitle';
import { useEffect, useState } from 'react';

export default function Home() {
  const [providerPool, setProviderPool] = useState([]);
  const [error, setError] = useState(null);
  const [gb, setGb] = useState(1000); // Par défaut 1000 GB
  const [days, setDays] = useState(365); // Par défaut 365 jours

  useEffect(() => {
    async function fetchProviderPool() {
      try {
        const { storage } = await initializeJackal();

        // Récupérez le pool de fournisseurs
        const pool = storage.providerPool;
        setProviderPool(pool);
      } catch (err) {
        console.error('Error loading provider pool:', err);
        setError('Failed to load provider pool.');
      }
    }

    fetchProviderPool();
  }, []);

  async function handlePurchase() {
    try {
      const { storage } = await initializeJackal();

      const options = {
        gb,
        days,
      };

      await storage.purchaseStoragePlan(options);
      alert(`Storage plan purchased: ${gb} GB for ${days} days.`);
    } catch (err) {
      console.error('Error purchasing storage plan:', err);
      alert('Failed to purchase storage plan.');
    }
  }

  return (
    <div className="container">
      <PageTitle title="Decentralized Storage" />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div className="form-group mt-4">
        <label htmlFor="gb-slider" className="form-label">
          Select Storage Size: {gb} GB
        </label>
        <input
          type="range"
          id="gb-slider"
          className="form-range"
          min="1"
          max="2000"
          step="1"
          value={gb}
          onChange={(e) => setGb(Number(e.target.value))}
        />
      </div>

      <div className="form-group mt-4">
        <label htmlFor="days-slider" className="form-label">
          Select Duration: {days} Days
        </label>
        <input
          type="range"
          id="days-slider"
          className="form-range orange-range-color"
          min="1"
          max="365"
          step="30"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </div>

      <button
        className="btn mt-4 bg-warning"
        onClick={handlePurchase}
      >
        Purchase Storage Plan
      </button>
    </div>
  );
}
