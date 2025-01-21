import Image from 'next/image';
import Link from 'next/link';

function Header() {
    return (
        <header>
            <nav className="navbar navbar-expand-lg navbar-dark bg-dark p-0">
                <div className="container-fluid">
                <Link className="navbar-brand" href="/" as={'image'}>
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
                        <a className="nav-link" href="/pricing">Pricing</a>
                    </li>
                    <li className="nav-item">
                        <a className="nav-link" href="/faq">FAQ</a>
                    </li>
                    <li className="nav-item">
                        <a className="nav-link" href="/login">Login</a>
                    </li>
                </ul>
                </div>
               </div>
            </nav>
        </header>
    )
}

export default Header;