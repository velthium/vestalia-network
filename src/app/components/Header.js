import Image from 'next/image';

function Header() {
    return (
        <header>
            <nav>
                <Image
                src="/images/Logo.webp"
                alt="Logo Vestalia Network"
                width={75}
                height={75}
                />
               <p>Header</p>
            </nav>
        </header>
    )
}

export default Header;