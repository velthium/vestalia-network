function Footer() {
    return(
        <footer className="fixed-bottom">
            <ul className="nav justify-content-center p-3">
                <li className="nav-item">
                    <a
                    className="nav-link px-2 text-body-secondary"
                    href="/faq"
                    >FAQ
                    </a>
                </li>
                <li className="nav-item">
                    <a
                    className="nav-link px-2 text-body-secondary"
                    href="https://gitopia.com/dark-velthium/vestalia-network"
                    target="_blank">Gitopia
                    </a>
                </li>
            </ul>
        </footer>
    )  
}

export default Footer;