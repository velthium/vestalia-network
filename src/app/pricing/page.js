'use client';

import { initializeJackal } from '@/lib/jackalClient';
import PageTitle from '@/components/PageTitle';
import { useEffect, useState } from 'react';

export default function Home() {
  const [providerPool, setProviderPool] = useState([]);
  const [error, setError] = useState(null);
  const [gb, setGb] = useState(999); // Par défaut 999 GB
  const [days, setDays] = useState(365); // Par défaut 365 jours
  const [unit, setUnit] = useState('GB'); // Par défaut GB

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

      // Assurez-vous que le stockage est dans les limites
      const storageInGb = unit === 'TB' ? Math.min(gb * 1000, 999000) : gb;

      const options = {
        gb: storageInGb,
        days,
      };

      await storage.purchaseStoragePlan(options);
      alert(`Storage plan purchased: ${storageInGb} GB for ${days} days.`);
    } catch (err) {
      console.error('Error purchasing storage plan:', err);
      alert('Failed to purchase storage plan.');
    }
  }

  function handleUnitChange(event) {
    const selectedUnit = event.target.value;
    setUnit(selectedUnit);

    // Convert current storage size to the selected unit and enforce min/max limits
    setGb((prevGb) => {
      let newGb;
      if (selectedUnit === 'TB') {
        newGb = prevGb / 1000;
        // Enforce minimum of 1 TB and maximum of 999 TB
        if (newGb < 1) newGb = 1;
        if (newGb > 999) newGb = 999;
      } else {
        newGb = prevGb * 1000;
        // Enforce maximum of 999000 GB
        if (newGb > 999000) newGb = 999000;
      }
      return newGb;
    });
  }

  return (
    <div className="container">
      <PageTitle title="Pricing" />

      <div className="form-check text-start">
        <input
          className="form-check-input"
          type="radio"
          name="storageUnit"
          id="unit-gb"
          value="GB"
          checked={unit === 'GB'}
          onChange={handleUnitChange}
        />
        <label className="form-check-label" htmlFor="unit-gb">
          GB
        </label>
      </div>
      <div className="form-check text-start">
        <input
          className="form-check-input"
          type="radio"
          name="storageUnit"
          id="unit-tb"
          value="TB"
          checked={unit === 'TB'}
          onChange={handleUnitChange}
        />
        <label className="form-check-label" htmlFor="unit-tb">
          TB
        </label>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div className="form-group mt-4">
        <label htmlFor="storage-slider" className="form-label">
          Select Storage Size: {unit === 'TB' ? gb + ' TB' : gb + ' GB'}
        </label>
        <input
          type="range"
          id="storage-slider"
          className="form-range"
          min={unit === 'GB' ? 1 : 1}
          max={unit === 'GB' ? 999 : 999}
          step={unit === 'GB' ? 1 : 1}
          value={unit === 'GB' ? gb : gb} // No need to adjust value since it syncs with state
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

      <button className="btn mt-4 bg-warning" onClick={handlePurchase}>
        Purchase Storage Plan
      </button>
    </div>
  );
}
