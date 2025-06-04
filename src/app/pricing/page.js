'use client';

import { initializeJackal } from '@/lib/jackalClient';
import PageTitle from '@/components/PageTitle';
import { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { showSuccessAlert } from '@/utils/alerts/success';
import { showErrorAlert } from '@/utils/alerts/error';
import { storageAsUsd, storageAsJkl } from '@/lib/pricingUtils'; // <-- importe tes fonctions

const MAX_SIZE = 999;
const MAX_YEARS = 90;

export default function Home() {
  const [size, setSize] = useState(1);
  const [years, setYears] = useState(1);
  const [unit, setUnit] = useState('GB');
  const [estimatedUsd, setEstimatedUsd] = useState('');
  const [estimatedJkl, setEstimatedJkl] = useState('');

  const { userName } = useUser();
  const router = useRouter();

  const updateEstimates = () => {
    const tb = unit === 'GB' ? size / 1000 : size;
    const jklPrice = 0.05376;
    const ref = false;

    setEstimatedUsd(storageAsUsd(years, tb, ref));
    setEstimatedJkl(storageAsJkl(years, tb, jklPrice, ref));
  };

  useEffect(() => {
    updateEstimates();
  }, [size, years, unit]);

  async function handlePurchase() {
    try {
      const { storage } = await initializeJackal();
      const storageSize = unit === 'GB' ? size : size * 1000;
      const days = years * 365;

      const options = { gb: storageSize, days };

      await storage.purchaseStoragePlan(options);

      showSuccessAlert(
        'Storage plan purchased',
        `${size} ${unit} (${storageSize} bytes) for ${years} years.`
      );
    } catch (err) {
      console.log(err);
      showErrorAlert('Oops!', err?.txResponse?.rawLog || err.message || 'Something went wrong');
    }
  }

  return (
    <div className="container">
      <PageTitle title="Pricing" />
      <p>Select the storage size and the duration of your plan</p>

      <div className="p-5 bg-ivory rounded shadow-sm">
        <div className="d-flex justify-content-evenly flex-wrap">
          <div className="form-group">
            <label htmlFor="size-input" className="form-label">Enter Storage Size:</label>
            <div className="input-group w-100 m-auto">
              <input
                type="number"
                id="size-input"
                className="form-control bg-sunshine w-75 m-auto"
                min={1}
                max={MAX_SIZE}
                value={size}
                onChange={(e) => setSize(Math.min(Math.max(1, Number(e.target.value)), MAX_SIZE))}
              />
              <span className="input-group-text">{unit}</span>
            </div>
            <div className="d-flex justify-content-center pt-3">
              {['GB', 'TB'].map((value, index) => (
                <div
                  className={`form-check text-start ${index > 0 ? 'ms-3' : ''}`}
                  key={value}
                >
                  <input
                    className="form-check-input"
                    type="radio"
                    name="storageUnit"
                    id={`unit-${value.toLowerCase()}`}
                    value={value}
                    checked={unit === value}
                    onChange={() => setUnit(value)}
                  />
                  <label className="form-check-label" htmlFor={`unit-${value.toLowerCase()}`}>
                    {value}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="years-input" className="form-label">Enter Duration:</label>
            <div className="input-group w-100 m-auto">
              <input
                type="number"
                id="years-input"
                className="form-control bg-sunshine w-50 m-auto"
                min="1"
                max={MAX_YEARS}
                value={years}
                onChange={(e) => setYears(Math.min(Math.max(1, Number(e.target.value)), MAX_YEARS))}
              />
              <span className="input-group-text">Years</span>
            </div>
          </div>
        </div>

        {estimatedUsd && estimatedJkl && (
          <div className="text-center my-4">
            <div>Estimated cost: <strong>{estimatedUsd} USD</strong></div>
            <div>Approx. <strong>{estimatedJkl}</strong></div>
          </div>
        )}

        <hr className="my-5 w-75 m-auto" />

        {userName ? (
          <button className="btn bg-warning px-4 py-2 shadow-sm mx-auto" onClick={handlePurchase}>
            Purchase Storage Plan
          </button>
        ) : (
          <a href="/login" className="btn bg-warning px-4 py-2 shadow-sm mx-auto">
            Login to purchase
          </a>
        )}
      </div>
    </div>
  );
}
