import Image from 'next/image';

function Header() {
    return (
        <header>
            <nav className="navbar navbar-expand-lg bg-body-tertiary">
                <div className="container-fluid">
                <a className="navbar-brand" href="#">
                    <Image
                        src="/images/Logo.jpg"
                        alt="Logo Vestalia Network"
                        width={60}
                        height={60}
                        className="rounded"
                        loading="eager"
                    />
                    <span className="ms-3">Vestalia Network</span>
                </a>
                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarText" aria-controls="navbarText" aria-expanded="false" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarText">
                <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
                    <li className="nav-item">
                        <a className="nav-link" href="#">FAQ</a>
                    </li>
                    <li className="nav-item">
                        <a className="nav-link" href="#">Login</a>
                    </li>
                </ul>
                </div>
               </div>
            </nav>
        </header>
    )
}

export default Header;