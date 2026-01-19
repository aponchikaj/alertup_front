// import TiktokIcon from '../assets/images/tt.png'
// import InstagramIcon from '../assets/images/ig.png';
import { Link } from 'react-router-dom';
import Sponsors from './sponsors';

const Footer = ()=>{
    return(
        <footer className="w-full p-[10px] h-auto flex bg-black flex flex-col items-center justify-center text-center">
            
            <section className="text-center">
                <h1 className="text-2xl text-white font-thin">Alert<span className="text-sm text-[#FF7B22]">up</span></h1>
            </section>

            <section className="flex items-center justify-center ">
                <Sponsors/>
            </section>

            <div className="w-1/2 mx-auto h-[1px] bg-[#FF7B22] my-[10px]" />

            <section className="flex flex-col gap-2">
                <h1 className="text-white text-2xl">Explore</h1>

                <ul className="flex flex-col text-center items-center justify-center text-white">
                    <Link to={'/'}>Home</Link>
                    <Link to={'/scan'}>Scan</Link>
                    <Link to={'/contact'}>Contact</Link>
                    {/* <Link to={'/premium'}>Premium</Link> */}
                </ul>
            </section>

            {/* <section className="flex items-center justify-center gap-1 my-[10px]"> */}
                {/* <a href=""><button><img src={TiktokIcon} alt="tiktok" className='w-[30px] cursor-pointer' /></button></a> */}
                {/* <a href=""><button><img src={InstagramIcon} alt="instagram" className='w-[30px] cursor-pointer' /></button></a> */}
            {/* </section> */}

            <section className="text-center items-center flex flex-col justify-center text-white text-sm">
                {/* <h1>By <a href="https://lazare-mirziashvili.vercel.app/home" className="underline hover:text-[#FF7B22] ease-in-out duration-100">Lazare</a></h1> */}
                <p>Alertup &copy; {new Date().getFullYear()}</p>
            </section>

        </footer>
    )
}

export default Footer;