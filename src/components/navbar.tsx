import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import foxImage from '../assets/images/fox.png';
import settingsIcon from '../assets/images/settings.png';
import './navbar.css';
import { getMe } from "../apis/me";

const Navbar = () => {
  const [menuMode, setMenuMode] = useState<boolean>(false);
  const [isLogged, setIsLogged] = useState<boolean>(false);

  const location = useLocation(); // track route changes

  const toggleMenu = (mode: boolean) => setMenuMode(mode);

  // Check if user is logged in on every route change
  useEffect(() => {
    const checkIfLoggedIn = async () => {
      try {
        const res = await getMe();
        setIsLogged(!!res?.Success);
      } catch {
        setIsLogged(false);
      }
    };
    checkIfLoggedIn();
  }, [location.pathname]); // ✅ runs whenever the route changes

  // Prevent scroll when sidebar is open
  useEffect(() => {
    document.body.style.overflow = menuMode ? "hidden" : "auto";
  }, [menuMode]);

  const UNAUTHORIZED_NAV_BTNS = [
    { to: '/', title: 'Home' },
    { to: '/scan', title: 'Scan' },
    { to: '/contact', title: 'Contact' },
  ];

  const AUTHORIZED_NAV_BTNS = [
    { to: '/dashboard', title: 'Dashboard' },
    { to: '/scan', title: 'Scan' },
    { to: '/mybuildings', title: 'Buildings' },
    { to: '/new', title: 'New' },
  ];

  // Render Navbar
  return menuMode ? (
    // Mobile sidebar
    <nav className="fixed top-0 left-0 w-[80%] h-screen bg-black z-50 sidebarAnim rounded-r-[15px] p-4 flex flex-col justify-between">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-thin text-white">
          Alert<span className="text-sm text-[#FF7B22]">up</span>
        </h1>
        <button onClick={() => toggleMenu(false)} className="text-red-500 text-2xl font-bold">X</button>
      </header>

      <main className="flex flex-col items-center justify-center gap-4">
        {(isLogged ? AUTHORIZED_NAV_BTNS : UNAUTHORIZED_NAV_BTNS).map((b, i) => (
          <Link
            key={i}
            to={b.to}
            onClick={() => toggleMenu(false)}
            className="text-xl text-white font-thin hover:font-medium ease-in-out duration-200 hover:scale-110 hover:text-[#FF7B22]"
          >
            {b.title}
          </Link>
        ))}

        {isLogged == false && <div className="h-[1px] w-full bg-[#FF7B22] my-4" />}

        {isLogged && (
          <Link onClick={() => toggleMenu(false)} to="/settings" className="hover:scale-110 ease-in-out duration-200">
            <img src={settingsIcon} alt="settings" className="w-[20px]" />
          </Link>
        )}

        {!isLogged && (
          <>
            <Link onClick={() => toggleMenu(false)} to="/register" className="text-white font-thin hover:font-medium hover:scale-110 hover:text-[#FF7B22]">
              Join now
            </Link>
            <Link onClick={() => toggleMenu(false)} to="/login" className="text-white font-thin hover:font-medium hover:scale-110 hover:text-[#FF7B22]">
              Log in
            </Link>
          </>
        )}
      </main>

      <footer className="text-center text-white text-sm">
        Alertup &copy; {new Date().getFullYear()}
      </footer>
    </nav>
  ) : (
    // Desktop Navbar
    <nav className="w-full h-[10vh] bg-black rounded-b-[15px] flex items-center justify-between px-4 navbarAnim fixed top-0 left-0 z-40">
      {/* Logo */}
      <section className="flex items-center gap-2">
        <img src={foxImage} alt="fox" className="w-[25px] md:w-[35px]" />
        <h1 className="text-2xl text-white font-light">
          Alert<span className="text-sm text-[#FF7B22]">up</span>
        </h1>
      </section>

      {/* Hamburger menu (mobile) */}
      <section className="md:hidden">
        <button onClick={() => toggleMenu(true)} className="flex flex-col gap-[5px]">
          <div className="w-[40px] h-[5px] rounded-[1px] bg-[#FF7B22]" />
          <div className="w-[40px] h-[5px] rounded-[1px] bg-[#FF7B22]" />
          <div className="w-[40px] h-[5px] rounded-[1px] bg-[#FF7B22]" />
        </button>
      </section>

      {/* Desktop menu */}
      <ul className="hidden md:flex items-center gap-4 text-white">
        {(isLogged ? AUTHORIZED_NAV_BTNS : UNAUTHORIZED_NAV_BTNS).map((b, i) => (
          <Link
            key={i}
            to={b.to}
            className="font-thin hover:font-medium ease-in-out duration-200 hover:scale-110 hover:text-[#FF7B22]"
          >
            {b.title}
          </Link>
        ))}

        {isLogged && (
          <Link to="/settings" className="hover:scale-110 ease-in-out duration-200">
            <img src={settingsIcon} alt="settings" className="w-[20px]" />
          </Link>
        )}

        {!isLogged && (
          <>
            <Link to="/register" className="p-[5px] rounded-full border-2 border-[#FF7B22] text-white 
                     bg-[#FF7B22] hover:bg-black transition-all duration-300 
                     hover:scale-105 active:scale-105">
              Join
            </Link>
            <Link to="/login" className="font-thin hover:font-medium ease-in-out duration-200 hover:scale-110 hover:text-[#FF7B22]">
              Log in
            </Link>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
