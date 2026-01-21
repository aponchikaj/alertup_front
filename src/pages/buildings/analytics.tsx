/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { GET_BUILDING_ANALYTICS } from "../../apis/administration"

interface EMERGENCY_SCHEMA {
    _id:string;
    buildingID:string;
    scanned:number;
    evacuated:number;
    calledEmergency:number;
    isFinished:boolean;
    startedAt:Date;
    endedAt:Date;
}

export default function AnalyticsPage(){

    const {buildingId} = useParams()

    const [loading,setLoading] = useState(true)
    const [serverError,setServerError] = useState("")

    const [EMERGENCIES,SET_EMERGENCIES] = useState<EMERGENCY_SCHEMA[]>([])

    const [dateFrom, setDateFrom] = useState<string>("")
    const [dateTo, setDateTo] = useState<string>("")
    
    const getAnalytics=async()=>{
        setLoading(true)
        setServerError("")
        try{
            const res = await GET_BUILDING_ANALYTICS(buildingId,{
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined})
            // console.log(res)
            if(!res) {setServerError("Something went wrong."); return}
            if(res.Success==false) {setServerError(res.Message);return}
            
            SET_EMERGENCIES(res.Message)
        }catch{
            setServerError("Something went wrong.")
        }finally{
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!buildingId) return
        getAnalytics()
    }, [dateFrom, dateTo])

    if(loading==true){
        return(
            <main className="w-full h-screen flex items-center justify-center bg-[#353535]">
                <h1 className="text-white text-2xl font-medium">Loading...</h1>
            </main>
        )
    }

    if(loading==false && serverError !== ""){
        return(
            <main className="w-full h-screen flex flex-col gap-2 items-center justify-center bg-[#353535]">
                <h1 className="text-red-500 text-2xl font-bold ">{serverError}</h1>
                <button onClick={getAnalytics} className="bg-[#FF7B22] hover:bg-[#FF7B22]/80 text-white rounded-[5px] p-[5px] ease-in-out duration-200 cursor-pointer">Retry</button>
            </main>
        )
    }

    if(loading == false && serverError == ""){
        return(
            <main className="w-full min-h-screen h-auto flex flex-col bg-[#353535]">
                <div className="w-full h-[10dvh]" />
                <header className="w-full h-auto p-[10px] flex items-center text-center justify-center">
                    <h1 className="text-white text-2xl font-medium md:text-3xl">Analytics</h1>
                </header>
                {
                    EMERGENCIES.length===0 && (
                        <section className="w-full h-full p-[10px] flex flex-col gap-2 items-center justify-center text-center">
                            <p className="text-white/60 text-center">
                                No emergencies found for this period.
                            </p>
                            <button onClick={()=>{setDateFrom("");setDateTo("");getAnalytics()}} className="text-lg ease-in-out duration-100 hover:bg-[#FF7B22]/80 cursor-pointer text-white bg-[#FF7B22] p-[5px] rounded-[10px]">Retry</button>
                        </section>
                    )
                }

                {
                    EMERGENCIES && (<>
                        <section className="w-full flex justify-center p-4">
                            <div className="w-full max-w-xl bg-[#111] border border-[#FF7B22]/40 rounded-2xl p-5 shadow-lg">
                                
                                <h2 className="text-white text-lg font-light text-center mb-4">
                                    Filter by Date
                                </h2>

                                <div className="flex flex-col md:flex-row gap-4">
                                
                                {/* From */}
                                <div className="flex flex-col w-full">
                                    <label className="text-sm text-white/70 mb-1">
                                    From
                                    </label>
                                    <input
                                    type="date"
                                    className="
                                        w-full bg-transparent text-white 
                                        border border-[#FF7B22]/50 
                                        rounded-xl px-3 py-2
                                        focus:outline-none focus:border-[#FF7B22]
                                        focus:ring-2 focus:ring-[#FF7B22]/40
                                        transition
                                    "
                                    onChange={(e)=>{setDateFrom(e.target.value);getAnalytics()}}
                                    value={dateFrom}
                                    />
                                </div>

                                {/* To */}
                                <div className="flex flex-col w-full">
                                    <label className="text-sm text-white/70 mb-1">
                                    To
                                    </label>
                                    <input
                                    type="date"
                                    className="
                                        w-full bg-transparent text-white 
                                        border border-[#FF7B22]/50 
                                        rounded-xl px-3 py-2
                                        focus:outline-none focus:border-[#FF7B22]
                                        focus:ring-2 focus:ring-[#FF7B22]/40
                                        transition
                                    "
                                    onChange={(e)=>{setDateTo(e.target.value);getAnalytics()}}
                                    value={dateTo}
                                    />
                                </div>

                                </div>
                            </div>
                        </section>
                        <section className="w-full h-full p-[10px] gap-2 flex flex-wrap items-center justify-center">
                            {EMERGENCIES.map((e,i)=>(
                                <Link to={'/building/'+e.buildingID+'/'+e._id+'/analytics'} key={i} className="w-auto p-[10px] border border-[#FF7B22] flex items-center justify-center text-center bg-[#FF7B22]/50 rounded-[10px] flex-col">
                                    <h1 className="text-white font-medium ">Emergency</h1>
                                    <p className="text-sm text-white font-thin">{new Date(e.startedAt).toLocaleDateString()}</p>
                                    <p className="text-sm text-white font-thin">{new Date(e.startedAt).toLocaleTimeString()}</p>
                                </Link>
                            ))}
                        </section>
                    </>)
                }
            </main>
        )
    }
}