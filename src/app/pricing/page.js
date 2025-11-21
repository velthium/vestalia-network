'use client';
import { storageAsUsd, storageAsJkl } from '@/lib/pricingUtils';
import { showSuccessAlert } from '@/utils/alerts/success';
import { initializeJackal } from '@/lib/jackalClient';
import { showErrorAlert } from '@/utils/alerts/error';
import { useUser } from '@/context/UserContext';
import { FaHdd, FaClock } from 'react-icons/fa';
import PageTitle from '@/components/PageTitle';
import { useState, useEffect } from 'react';

const MAX_SIZE = 999, MAX_YEARS = 90;

export default function Home() {
  const [size, setSize] = useState(1);
  const [years, setYears] = useState(1);
  const [unit, setUnit] = useState('GB');
  const [estimatedUsd, setEstimatedUsd] = useState('');
  const [estimatedJkl, setEstimatedJkl] = useState('');
  const { userName } = useUser();

  useEffect(() => {
    const tb = unit === 'GB' ? size / 1000 : size;
    setEstimatedUsd(storageAsUsd(years, tb, false));
    setEstimatedJkl(storageAsJkl(years, tb, 0.05376, false));
  }, [size, years, unit]);

  const handlePurchase = async () => {
    try {
      const { storage } = await initializeJackal();
      const storageSize = unit === 'GB' ? size : size * 1000;
      await storage.purchaseStoragePlan({ gb: storageSize, days: years * 365 });
      showSuccessAlert('Storage plan purchased', `${size} ${unit} (${storageSize} bytes) for ${years} years.`);
    } catch (err) {
      console.debug(err);
      showErrorAlert('Oops!', err?.txResponse?.rawLog || err.message || 'Something went wrong');
    }
  };

  const clamp = (v, min, max) => Math.min(Math.max(min, Number(v)), max);

  return (
    <div className="container">
      <PageTitle title="Pricing" />
      <p>Select the storage size and the duration of your plan</p>
      <div className="p-5 bg-ivory rounded shadow-sm">
        <div className="d-flex justify-content-evenly flex-wrap">
          <div className="form-group">
            <label htmlFor="size-input" className="form-label d-flex align-items-center gap-2"><FaHdd size={32} color="#F4B400" className="icon-yellow me-2" /> Enter Storage Size:</label>
            <div className="input-group w-100 m-auto"><input type="number" id="size-input" className="form-control bg-sunshine w-75 m-auto" min={1} max={MAX_SIZE} value={size} onChange={(e) => setSize(clamp(e.target.value, 1, MAX_SIZE))} /><span className="input-group-text">{unit}</span></div>
            <div className="d-flex justify-content-center pt-3">{['GB', 'TB'].map((v, i) => <div className={`form-check text-start ${i > 0 ? 'ms-3' : ''}`} key={v}><input className="form-check-input" type="radio" name="storageUnit" id={`unit-${v.toLowerCase()}`} value={v} checked={unit === v} onChange={() => setUnit(v)} /><label className="form-check-label" htmlFor={`unit-${v.toLowerCase()}`}>{v}</label></div>)}</div>
          </div>
          <div className="form-group">
            <label htmlFor="years-input" className="form-label d-flex align-items-center gap-2"><FaClock size={32} color="#F4B400" className="icon-yellow me-2" /> Enter Duration:</label>
            <div className="input-group w-100 m-auto"><input type="number" id="years-input" className="form-control bg-sunshine w-50 m-auto" min="1" max={MAX_YEARS} value={years} onChange={(e) => setYears(clamp(e.target.value, 1, MAX_YEARS))} /><span className="input-group-text">Years</span></div>
          </div>
        </div>
        {estimatedUsd && estimatedJkl && <div className="text-center my-4"><div>Estimated cost: <strong>{estimatedUsd} USD</strong></div><div>Approx. <strong>{estimatedJkl}</strong></div></div>}
        <hr className="my-5 w-75 m-auto" />
        {userName ? <button className="btn bg-warning px-4 py-2 shadow-sm mx-auto" onClick={handlePurchase}>Purchase Storage Plan</button> : <a href="/login" className="btn bg-warning px-4 py-2 shadow-sm mx-auto">Login to purchase</a>}
      </div>
    </div>
  );
}
