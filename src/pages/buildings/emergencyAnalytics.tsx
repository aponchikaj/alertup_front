/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { GET_EMERGENCY_DATA } from "../../apis/administration"

interface emergencySchema {
    _id:string;
    buildingID:string;
    scanned:number;
    evacuated:number;
    calledEmergency:number;
    isFinished:boolean;
    startedAt:string;
    endedAt:string;
}

interface logsSchema {
    logMessage:string,
    logType:string,
    isEmergency:boolean,
    createdAt:string,
    buildingID:string
}

export default function EmergencyAnalytics(){
    
    const {buildingId,emergencyId} = useParams()
    
    const [serverError,setServerError] = useState('')
    const [loading,setLoading] = useState(true)
    const [emergencyData, setEmergencyData] = useState<emergencySchema | null>(null);
    const [logsData, setLogsData] = useState<logsSchema[]>([]);

    const getEmergencyData = async()=>{
        setLoading(true)
        try{
            const res = await GET_EMERGENCY_DATA({buildingID:buildingId,emergencyID:emergencyId}) // filters unda
            console.log(res)
            if(!res ) {
                setServerError("Something went wrong.")
                setLoading(false)
                return;
            };
            if(res.Success==false) {
                setServerError(res.Message)
                setLoading(false)
                return;
            };
            
            setEmergencyData(res.Message.emergency)
            setLogsData(res.Message.logs)
        }catch{
            setServerError("Something went wrong.")
        }finally{
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!buildingId || !emergencyId) return
        const getEmergencyData = async()=>{
            setLoading(true)
            try{
                const res = await GET_EMERGENCY_DATA({buildingID:buildingId,emergencyID:emergencyId}) // filters unda
                console.log(res)
                if(!res ) {
                    setServerError("Something went wrong.")
                    setLoading(false)
                    return;
                };
                if(res.Success==false) {
                    setServerError(res.Message)
                    setLoading(false)
                    return;
                };
                
                setEmergencyData(res.Message.emergency)
                setLogsData(res.Message.logs)
            }catch{
                setServerError("Something went wrong.")
            }finally{
                setLoading(false)
            }
        }
        getEmergencyData()
    }, [buildingId, emergencyId])
    
    if(loading==true && serverError == ""){
        return(
            <main className="w-full h-screen flex items-center justify-center text-center bg-[#353535]">
                <h1 className="text-white font-medium text-2xl ">Loading...</h1>
            </main>
        )
    }

    if(loading == false && serverError !== ""){
        return(
            <main className="w-full h-screen flex flex-col gap-2 items-center justify-center text-center bg-[#353535]">
                <h1 className="text-white font-medium text-2xl">{serverError}</h1>
                <button onClick={()=>getEmergencyData()} className="text-lg ease-in-out duration-100 hover:bg-[#FF7B22]/80 cursor-pointer text-white bg-[#FF7B22] p-[5px] rounded-[10px]">Retry</button>
            </main>
        )
    }

    {
        return(
            <main className="flex flex-col bg-[#353535] min-h-screen">
                <div className="w-full h-[10dvh]" />
                <header className="w-full p-[10px] flex flex-col text-center items-center text-white">
                    <h1 className="text-white text-2xl font-medium">Emergency</h1>
                    {emergencyData && (
                        <p>
                            {new Date(emergencyData.startedAt).toLocaleDateString()} - {new Date(emergencyData.startedAt).toLocaleTimeString()}
                        </p>
                    )}
                </header>
                <section className="w-full p-[10px] flex items-center justify-center flex-wrap h-auto gap-3">
                    <div className="border text-white rounded-[10px] hover:bg-[#FF7B22]/50 min-w-[150px] p-[10px] border-[#FF7B22] flex flex-col items-center text-center">
                        <h2>Evacuated</h2>
                        <h1 className="text-2xl font-medium">{emergencyData?.evacuated}</h1>
                    </div>

                    <div className="border text-white rounded-[10px] min-w-[150px] hover:bg-[#FF7B22]/50 p-[10px] border-[#FF7B22] flex flex-col items-center text-center">
                        <h2>Scanned</h2>
                        <h1 className="text-2xl font-medium">{emergencyData?.scanned}</h1>
                    </div>

                    <div className="border text-white rounded-[10px] min-w-[150px] hover:bg-[#FF7B22]/50 p-[10px] border-[#FF7B22] flex flex-col items-center text-center">
                        <h2>Called</h2>
                        <h1 className="text-2xl font-medium">{emergencyData?.calledEmergency}</h1>
                    </div>
                </section>
                <section className="w-full min-h-full p-[10px] flex flex-col items-center justify-center">
                    <h1 className="text-white text-2xl font-medium">Logs</h1>
                    <section className="w-[90%] h-[80dvh] bg-black rounded-xl border border-[#FF7B22]/50">
                        <ul className='w-full h-[90%] flex flex-col overflow-y-auto gap-3 items-start justify-end'>
                            {   
                                logsData.length === 0 ? <p className="text-gray-400 text-center w-full mt-4">No logs available</p> :
                                logsData.map((m,i)=>(
                                    <p  className={`text-white w-full  px-[10px] border-[#FF7B22]/50 font-medium `} key={i}>{m.logMessage} - {new Date(m.createdAt).toLocaleString()} - {m.logType}</p>
                                ))
                            }
                        </ul>
                    </section>
                </section>
            </main>
        )
    }
}