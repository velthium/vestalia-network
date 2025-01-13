'use client';

import { initializeJackal } from '@/lib/jackalClient';
import PageTitle from '@/components/PageTitle';
import { useEffect, useState } from 'react';

export default function Home() {
  const [providerPool, setProviderPool] = useState([]);
  const [error, setError] = useState(null);
  const [size, setSize] = useState(1); // Default: 1 MB, GB, or TB depending on unit
  const [years, setYears] = useState(1); // Default: 1 year
  const [unit, setUnit] = useState('MB'); // Default: MB

  useEffect(() => {
    async function fetchProviderPool() {
      try {
        const { storage } = await initializeJackal();
        const pool = storage.providerPool; // Fetch provider pool
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

      // Convert storage size to bytes for backend
      let storageInBytes;
      if (unit === 'MB') {
        storageInBytes = size * 1000000; // 1 MB = 1,000,000 bytes
      } else if (unit === 'GB') {
        storageInBytes = size * 1000000000; // 1 GB = 1,000,000,000 bytes
      } else if (unit === 'TB') {
        storageInBytes = size * 1000000000000; // 1 TB = 1,000,000,000,000 bytes
      }

      const days = years * 365; // Convert years to days

      console.log(`Storage in Bytes: ${storageInBytes}, Unit: ${unit}, Size: ${size}, Days: ${days}`);


      const options = {
        bytes: storageInBytes,
        days,
      };

      await storage.purchaseStoragePlan(options);
      alert(`Storage plan purchased: ${size} ${unit} (${storageInBytes} bytes) for ${years} years (${days} days).`);
    } catch (err) {
      console.error('Error purchasing storage plan:', err);
      alert('Failed to purchase storage plan.');
    }
  }

  function handleUnitChange(event) {
    const selectedUnit = event.target.value;
    setUnit(selectedUnit);

    // Ensure size is within valid range for the selected unit
    setSize((prevSize) => {
      let newSize = prevSize;

      if (selectedUnit === 'MB') {
        if (prevSize > 999000) newSize = 999000; // Max 999,000 MB
      } else if (selectedUnit === 'GB') {
        if (prevSize > 999) newSize = 999; // Max 999 GB
      } else if (selectedUnit === 'TB') {
        if (prevSize > 999) newSize = 999; // Max 999 TB
      }

      return Math.max(1, newSize); // Enforce minimum size of 1
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
          id="unit-mb"
          value="MB"
          checked={unit === 'MB'}
          onChange={handleUnitChange}
        />
        <label className="form-check-label" htmlFor="unit-mb">
          MB
        </label>
      </div>
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
        <label htmlFor="size-input" className="form-label">
          Enter Storage Size ({unit}):
        </label>
        <input
          type="number"
          id="size-input"
          className="form-control"
          min={1}
          max={unit === 'MB' ? 999000 : 999}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        />
      </div>

      <div className="form-group mt-4">
        <label htmlFor="years-input" className="form-label">
          Enter Duration (Years):
        </label>
        <input
          type="number"
          id="years-input"
          className="form-control"
          min="1"
          max="90"
          value={years}
          onChange={(e) => setYears(Number(e.target.value))}
        />
      </div>

      <button className="btn mt-4 bg-warning" onClick={handlePurchase}>
        Purchase Storage Plan
      </button>
    </div>
  );
}
