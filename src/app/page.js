'use client';
import PageTitle from '@/components/PageTitle';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatBytes } from '@/utils/formatBytes';

export default function Home() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const getLastValue = (arr) => arr?.data?.at(-1)?.value ?? 0;
        const [users, files, space] = await Promise.all([
          fetch("https://stats-api.jackallabs.io/total_users").then(r => r.json()),
          fetch("https://stats-api.jackallabs.io/total_files").then(r => r.json()),
          fetch("https://stats-api.jackallabs.io/available_space").then(r => r.json()),
        ]);
        setStats([
          { label: "Total Users", value: getLastValue(users) },
          { label: "Total Files", value: Number(getLastValue(files)).toLocaleString('fr-FR') },
          { label: "Available space", value: formatBytes(getLastValue(space)) },
        ]);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    })();
  }, []);


  return (
    <div className="container text-center py-5">
      <PageTitle title="Decentralized Storage" />
      <h2 className='h5 my-3'>Store and manage your data securely on a decentralized encrypted network.</h2>
      <div className="d-flex flex-column flex-md-row justify-content-around p-3 bg-white shadow-sm rounded-4 w-75 m-auto">
        {loading ? <p>Loading statistics...</p> : stats.map((stat, i) => <div key={i} className="m-2"><p className="fw-bold">{stat.label}</p><p className="fs-5">{stat.value}</p></div>)}
      </div>
      <p className="my-5">This website offers a decentralized storage service where you can securely store your data without relying on any other platform.</p>
      <Link href="/login" className="btn btn-primary rounded-pill px-4" style={{ background: '#7B61FF', borderColor: '#7B61FF' }}>Get Started</Link>
      <div className="container my-5"><div className="row g-4">
        {[{src: "/images/ProtectedLogo.png", alt: "Jackal Network logo", title: "End-to-end encryption"}, {src: "/images/UltrafastLogo.png", alt: "Cloud storage icon", title: "Ultra fast sync"}].map((item, i) => (
          <div key={i} className="col-12 col-md-6"><div className="p-4 bg-white shadow-sm rounded-4 text-center"><Image src={item.src} alt={item.alt} width={200} height={200} className="img-fluid homepage-pictures" loading="lazy" /><h5 className="mb-3">{item.title}</h5></div></div>
        ))}
      </div></div>
      <h2 className='mt-5 pb-3'>The Team</h2>
      <section className='bg-purple m-md-3 p-md-5 py-3 rounded'>
        <h3>Velthium</h3>
        <a href='https://gitopia.com/dark-velthium' target='_blank'><Image src="/images/ReFiPunks558.webp" alt="NFT profile image of Velthium" width={300} height={300} className="img-fluid mx-auto border rounded shadow homepage-pictures" loading="lazy" /></a>
        <p className="mt-5">So far it is just me. Creator of this website. Web Developer.</p>
      </section>
    </div>
  );
}
