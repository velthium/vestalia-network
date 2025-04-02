'use client';

import { initializeJackal } from '@/lib/jackalClient';
import PageTitle from '@/components/PageTitle';
import { useState } from 'react';
import { showSuccessAlert } from '@/utils/alerts/success';
import { showErrorAlert } from '@/utils/alerts/error';

export default function Home() {
  const [size, setSize] = useState(1); // Default: 1 GB or TB depending on unit
  const [years, setYears] = useState(1); // Default: 1 year
  const [unit, setUnit] = useState('GB'); // Default: GB

  async function handlePurchase() {
    try {
      const { storage } = await initializeJackal();

      // Convert storage size based on the selected unit
      let storageSize;
      if (unit === 'GB') {
        storageSize = size;
      } else if (unit === 'TB') {
        storageSize = size * 1000
      }

      const days = years * 365; // Convert years to days

      const options = {
        gb: storageSize,
        days,
      };

      await storage.purchaseStoragePlan(options);
      showSuccessAlert('Storage plan purchased', `${size} ${unit} (${storageSize} bytes) for ${years} years.`);
    } catch (err) {
      console.log(err)
      showErrorAlert('Oops!', err?.txResponse?.rawLog || err.message || 'Something went wrong');
    }
  }

  function handleUnitChange(event) {
    const selectedUnit = event.target.value;
    setUnit(selectedUnit);

    // Ensure size is within valid range for the selected unit
    setSize((prevSize) => {
      let newSize = prevSize;

      if (selectedUnit === 'GB') {
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
      <p>Select the storage size and the duration of your plan</p>
      <div className="p-5 bg-ivory rounded shadow-sm">
        <div className="d-flex justify-content-evenly flex-wrap">
          <div className="form-group">
            <label htmlFor="size-input" className="form-label">
              Enter Storage Size:
            </label>
            <div className="input-group w-100 m-auto">
              <input
                type="number"
                id="size-input"
                className="form-control bg-sunshine w-75 m-auto"
                min={1}
                max={unit === 'GB' ? 999 : 999} // Max size for GB or TB
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
              <span className="input-group-text">{unit}</span>
            </div>
            <div className="d-flex justify-content-center pt-3">
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
              <div className="form-check text-start ms-3">
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
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="years-input" className="form-label">
              Enter Duration:
            </label>
            <div className="input-group w-100 m-auto">
            <input
              type="number"
              id="years-input"
              className="form-control bg-sunshine w-50 m-auto"
              min="1"
              max="90"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            />
          <span className="input-group-text">Years</span>
          </div>
          </div>
        </div>
        <hr className='my-5 w-75 m-auto' />
        <button className="btn bg-warning px-4 py-2 shadow-sm mx-auto" onClick={handlePurchase}>
          Purchase Storage Plan
        </button>
      </div>
    </div> 
  );
}
