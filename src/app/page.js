'use client';

import PageTitle from '@/components/PageTitle';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function Home() {
  const [stats, setStats] = useState([
    { label: 'Total Users', value: 0 },
    { label: 'Total Files', value: 0 },
    { label: 'Available space', value: 0 },
  ]);

useEffect(() => {
  const fetchStats = async () => {
    try {
      const [usersRes, filesRes, spaceRes] = await Promise.all([
        fetch('https://stats-api.jackallabs.io/total_users'),
        fetch('https://stats-api.jackallabs.io/total_files'),
        fetch('https://stats-api.jackallabs.io/available_space'),
      ]);

      const usersData = await usersRes.json();
      const filesData = await filesRes.json();
      const spaceData = await spaceRes.json();

      const total_users = usersData?.data?.[usersData.data.length - 1]?.value;
      const total_files = filesData?.data?.[filesData.data.length - 1]?.value;
      const available_space = spaceData?.data?.[spaceData.data.length - 1]?.value;

      setStats(prevStats =>
        prevStats.map(stat => {
          switch (stat.label) {
            case 'Total Users':
              return { ...stat, value: total_users || 0 };
            case 'Total Files':
              return { ...stat, value: total_files || 0 };
            case 'Available space':
              return { ...stat, value: available_space || 0 };
            default:
              return stat;
          }
        })
      );
    } catch (error) {
      console.error('Erreur lors du fetch :', error);
    }
  };

  fetchStats();
}, []);


  return (
    <div className="container text-center py-5">
      <PageTitle title="Decentralized Storage" />
      <h2 className='h5 my-3'>Unlock the power of decentralized storage with unparalleled flexibility. Choose exactly how much space you need for the duration you want, without unnecessary complexity.</h2>
      <div className='d-flex flex-column flex-md-row justify-content-around border p-md-2 bg-warning align-items-center rounded w-75 m-auto'>
      {stats.map((stat, i) => (
        <div key={i} className="m-2">
          <p>{stat.label}</p>
          <p>{stat.value}</p>
        </div>
      ))}
      </div>
      <p className="my-5">This website serves as a complement to Jackal Vault, offering users the opportunity to purchase additional storage space. It is designed specifically for those who need extra room to securely store their data, enhancing the Jackal Vault experience.</p>
      <div className='d-flex flex-column flex-sm-row justify-content-around bg-sunshine rounded'>
      <figure className='figure'>
        <a className='text-decoration-none' href='https://www.jackalprotocol.com/' target='_blank' aria-label="Visit the Jackal website (opens in new tab)" rel="noopener noreferrer">
          <figcaption className='figure-caption p-2'>Jackal website</figcaption>
          <Image
              src="/images/JackalLogo.webp"
              alt="Logo Jackal Network"
              width={300}
              height={300}
              className="img-fluid border rounded shadow homepage-pictures"
              loading="lazy"
          />
        </a>
      </figure>
      <figure className='figure'>
      <a className='text-decoration-none' href='https://vault.jackalprotocol.com/' target='_blank' aria-label="Visit the Jackal Vault website (opens in new tab)" rel="noopener noreferrer">
        <figcaption className='figure-caption p-2'>Jackal Application</figcaption>
        <Image
            src="/images/Cloud.webp"
            alt="Logo Cloud"
            width={300}
            height={300}
            className="img-fluid border rounded shadow homepage-pictures"
            loading="lazy"
        />
      </a>
      </figure>
      </div>
      <h2 className='mt-5 pb-3'>The Team</h2>
      <section  className='bg-warning m-md-3 p-md-5 py-3'>
        <h3>Velthium</h3>
        <a href='https://gitopia.com/dark-velthium' target='_blank'>
          <Image
              src="/images/ReFiPunks558.webp"
              alt="Nft Velthium"
              width={300}
              height={300}
              className="img-fluid mx-auto border rounded shadow homepage-pictures"
              loading="lazy"
          />
        </a>
        <p className="mt-5">So far it is just me. Creator of this website. Web Developer.</p>  
      </section >
    </div>
  );
}
