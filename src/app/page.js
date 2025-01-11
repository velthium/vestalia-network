'use client';

import PageTitle from '@/components/PageTitle';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="container text-center py-5">
      <PageTitle title="Decentralized Storage" />
      <h2 className='h5 my-3'>Unlock the power of decentralized storage with unparalleled flexibility. Choose exactly how much space you need for the duration you want, without unnecessary complexity.</h2>
      <div className='d-flex flex-column flex-md-row justify-content-around border p-md-2 bg-warning align-items-center rounded w-75 m-auto'>
          <div className='m-2'>
            <p>Total Users</p>
            <p></p>
          </div>
          <div className='m-2'>
            <p>Active Providers</p>
            <p></p>
          </div>
          <div className='m-2'>
            <p>Storage Purchased</p>
            <p></p>
          </div>
      </div>
      <p className="my-5">This website serves as a complement to Jackal Vault, offering users the opportunity to purchase additional storage space. It is designed specifically for those who need extra room to securely store their data, enhancing the Jackal Vault experience.</p>
      <div className='d-flex flex-column flex-sm-row justify-content-around bg-sunshine rounded'>
      <figure className='figure'>
        <a className='text-decoration-none' href='https://vault.jackalprotocol.com/'>
          <figcaption className='figure-caption p-2'>Jackal website</figcaption>
                              <Image
                                  src="/images/JackalLogo.webp"
                                  alt="Logo Vestalia Network"
                                  width={300}
                                  height={300}
                                  className="img-fluid border rounded shadow homepage-pictures"
                                  loading="eager"
                              />
        </a>
      </figure>
      <figure className='figure'>
      <a className='text-decoration-none' href='https://vault.jackalprotocol.com/'>
        <figcaption className='figure-caption p-2'>Jackal Application</figcaption>
                            <Image
                                src="/images/Cloud.webp"
                                alt="Logo Vestalia Network"
                                width={300}
                                height={300}
                                className="img-fluid border rounded shadow homepage-pictures"
                                loading="eager"
                            />
      </a>
      </figure>
      </div>
      <div className="main-timeline">

      </div>
    </div>
  );
}
