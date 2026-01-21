import { useEffect, useState } from 'react'
import REFRESH_ICON from '../../assets/images/refresh.png'
import { useParams } from 'react-router-dom'
import { CLEARBUILDINGLOGS, GETBUILDINGLOGS } from '../../apis/administration'

interface LOG_SCHEMA{
    logMessage:string,
    logType:string,
    isEmergency:boolean,
    createdAt:string,
    buildingID:string
}

export default function Logs(){

    const [LOGS,setLOGS] = useState<Array<LOG_SCHEMA>>([])
    const [serverError,setServerError] = useState("")
    const [loading,setLoading] = useState(true)
    const {buildingId} = useParams()
    const fetchLogs = async()=>{
        try{
            const res = await GETBUILDINGLOGS(buildingId)
            console.log(res)
            if(!res) {
                setServerError("Something went wrong.")
                setLoading(false)
                return;
            }
            if(!res.Success) {
                setServerError(res.Message);
                setLoading(false)
                return;
            }
            setLOGS(res.Message)
            setLoading(false)
        }catch{
            setServerError("Something went wrong.")
            setLoading(false)
            return;
        }
    }

    useEffect(()=>{
        fetchLogs()
        const interval = setInterval(() => {
            fetchLogs()
        }, 10000)

        return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[])

    const clearLogs = async()=>{
        setLoading(true)
        try{
            const res = await CLEARBUILDINGLOGS(buildingId)
            if(!res) {
                setServerError("Something went wrong.")
                setLoading(false)
                return;
            }
            if(!res.Success) {
                setServerError(res.Message);
                setLoading(false)
                return;
            }
            window.location.reload()
            setLoading(false)
        }catch{
            setServerError("Something went wrong.")
            setLoading(false)
            return;
        }
    }

    return(
        <main className="w-full h-[100dvh] bg-[#353535] flex flex-col items-center justify-center items-center">
            <section className="w-full h-[10vh]" />
            {/* logs box */}
            {
                serverError == "" && loading == true && (
                    <main className='w-full h-full p-[10px] flex items-center justify-center text-center'>
                        <h1 className='text-white'>Loading...</h1>
                    </main>
                )
            }
            {
                serverError !== "" && loading == false &&(
                    <main className='w-full h-full p-[10px] flex items-center justify-center text-center'>
                        <h1 className='text-white'>{serverError}</h1>
                    </main>
                )
            }
            {
                loading == false && serverError == "" &&
                <section className="w-[90%] h-[80dvh] bg-black rounded-xl border border-[#FF7B22]/50">
                    <header className="w-full h-[4vh] flex items-center justify-around text-center border-b border-[#FF7B22]/50">
                        <h1 className="text-white text-lg">Logs</h1>
                        <section className='flex gap-2 items-center'>
                            <button onClick={fetchLogs}><img src={REFRESH_ICON} alt="refresh" className='w-[20px] cursor-pointer' title='Refresh' /></button>
                            <button className='text-white cursor-pointer' onClick={clearLogs}>Clear</button>
                        </section>
                    </header>
                    <ul className='w-full h-[90%] flex flex-col overflow-y-auto gap-3 items-start justify-end'>
                        {   
                            LOGS &&
                            LOGS.map((m,i)=>(
                                <p  className={`text-white w-full  px-[10px] border-[#FF7B22]/50  font-medium `} key={i}>{m.logMessage} - {new Date(m.createdAt).toLocaleString()} - {m.logType}</p>
                            ))
                        }
                    </ul>
                </section>
            }

        </main>
    )
}