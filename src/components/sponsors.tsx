// import { Link } from "react-router-dom"
import IllusionImage from '../assets/images/sponsors/illusion.png'

const Sponsors = ()=>{

    const SPONSORS = [
        {
            to:"https://iluzia.vercel.app/",
            image:IllusionImage,
            name:'Illusion'
        },
    ]

    return(
        <section className="w-full p-[10px] flex flex-col items-center justify-center">
            <section className="w-full flex text-center items-center justify-center">
                <h1 className="text-lg md:text-xl text-[#FF7B22]">Trusted by</h1>
            </section>
            <ul className="w-full p-[10px] flex items-center justify-center gap-2 text-center">
                {
                    SPONSORS.map((s,i)=>(
                        <a key={i} href={s.to}><img src={s.image} className='w-[40px] md:w-[50px]' alt={s.name} title={s.name} /></a>
                    ))
                }
            </ul>
        </section>
    )
}

export default Sponsors