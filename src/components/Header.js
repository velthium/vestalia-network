'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';

function Header() {
    const { userName, setUserName } = useUser();

    const handleLogout = () => {
        setUserName(null);
        localStorage.removeItem('jackalConnected');
    };

    return (
        <header>
            <nav className="navbar navbar-expand-lg navbar-dark bg-dark p-0">
                <div className="container-fluid">
                    <Link className="navbar-brand d-flex align-items-center" href="/">
                        <Image
                            src="/images/Logo.webp"
                            alt="Logo Vestalia Network"
                            width={50}
                            height={50}
                            className="rounded"
                            loading="eager"
                            priority
                        />
                        <span className="ms-3">Vestalia Network</span>
                    </Link>

                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarText" aria-controls="navbarText" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>

                    <div className="collapse navbar-collapse" id="navbarText">
                        <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
                            <li className="nav-item">
                                <Link className="nav-link" href="/pricing">Pricing</Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" href="/faq">FAQ</Link>
                            </li>
                            <li className="nav-item">
                                {userName ? (
                                    <div className="d-flex align-items-center gap-2">
                                        <span className="nav-link text-success">👤 {userName}</span>
                                        <button className="btn btn-sm btn-outline-light" onClick={handleLogout}>
                                            Logout
                                        </button>
                                    </div>
                                ) : (
                                    <Link className="nav-link" href="/login">Login</Link>
                                )}
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
        </header>
    );
}

export default Header;
