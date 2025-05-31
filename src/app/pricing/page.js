'use client';

import { initializeJackal } from '@/lib/jackalClient';
import PageTitle from '@/components/PageTitle';
import { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { showSuccessAlert } from '@/utils/alerts/success';
import { showErrorAlert } from '@/utils/alerts/error';

const MAX_SIZE = 999;
const MAX_YEARS = 90;

export default function Home() {
  const [size, setSize] = useState(1);
  const [years, setYears] = useState(1);
  const [unit, setUnit] = useState('GB');

  const { userName } = useUser();
  const router = useRouter();

  async function handlePurchase() {
    try {
      const { storage } = await initializeJackal();

      const storageSize = unit === 'GB' ? size : size * 1000;
      const days = years * 365;

      const options = {
        gb: storageSize,
        days,
      };

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

  function handleUnitChange(event) {
    const selectedUnit = event.target.value;
    setUnit(selectedUnit);
    setSize((prevSize) => Math.min(Math.max(1, prevSize), MAX_SIZE));
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
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (!isNaN(value)) {
                    setSize(Math.min(Math.max(1, value), MAX_SIZE));
                  }
                }}
              />
              <span className="input-group-text">{unit}</span>
            </div>
            <div className="d-flex justify-content-center pt-3">
              {['GB', 'TB'].map((value, index) => (
                <div className={`form-check text-start ${index > 0 ? 'ms-3' : ''}`} key={value}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="storageUnit"
                    id={`unit-${value.toLowerCase()}`}
                    value={value}
                    checked={unit === value}
                    onChange={handleUnitChange}
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
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (!isNaN(value)) {
                    setYears(Math.min(Math.max(1, value), MAX_YEARS));
                  }
                }}
              />
              <span className="input-group-text">Years</span>
            </div>
          </div>
        </div>

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
