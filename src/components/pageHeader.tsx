import { Link } from "react-router-dom";
import backArrow from '../assets/images/backArrow.svg'

const PageHeader = ({title="",backIcon=true})=>{
    return(
        <header className="w-full h-auto p-[10px] flex flex-col items-center justify-center">

            <section className="w-full flex items-center justify-around">
                {
                    backIcon == true ? (
                        <section className="w-auto flex items-center justify-center">
                            <Link to={'/'}><img src={backArrow} alt="back" className="w-[30px] md:w-[40px]" /></Link>
                        </section>
                    ) : null
                }
                <section className="w-auto flex items-center justify-center">
                    <h1 className="text-2xl text-white font-bold md:text-3xl">{title}</h1>
                </section>
                {
                    backIcon == true ? (
                        <section/>
                    ) : null
                }
            </section>

        </header>
    )
}

export default PageHeader;