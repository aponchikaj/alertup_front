/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { GET_EMERGENCY_DATA } from "../../apis/administration"
import { usePageAnimations } from "../../lib/animations"
import { PageHeader, PageShell } from "../../components/ui/layout"
import { Button } from "../../components/ui/button"
import { Card } from "../../components/ui/card"
import { Alert, Badge, EmptyState, Skeleton } from "../../components/ui/feedback"
import {
    BellIcon,
    ChartIcon,
    ClockIcon,
    FileTextIcon,
    RefreshIcon,
    UsersIcon,
} from "../../components/ui/icons"

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
    const rootRef = usePageAnimations()

    const [serverError,setServerError] = useState('')
    const [loading,setLoading] = useState(true)
    const [emergencyData, setEmergencyData] = useState<emergencySchema | null>(null);
    const [logsData, setLogsData] = useState<logsSchema[]>([]);

    const getEmergencyData = async()=>{
        setLoading(true)
        // Reset up front. The render branches key off serverError, so a retry
        // after a failed load re-rendered the error screen even when the retry
        // itself succeeded — leaving no way out but a page reload.
        setServerError("")
        try{
            const res = await GET_EMERGENCY_DATA({buildingID:buildingId!,emergencyID:emergencyId!}) // filters unda
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
                const res = await GET_EMERGENCY_DATA({buildingID:buildingId!,emergencyID:emergencyId!}) // filters unda
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

    const STATS = emergencyData
        ? [
            { icon: UsersIcon, label: "Evacuated", value: emergencyData.evacuated },
            { icon: ChartIcon, label: "Scanned", value: emergencyData.scanned },
            { icon: BellIcon, label: "Called", value: emergencyData.calledEmergency },
        ]
        : []

    if(loading==true && serverError == ""){
        return(
            <PageShell width="wide">
                <PageHeader
                    title="Emergency"
                    description="Full breakdown of a recorded emergency."
                />
                <p className="sr-only" role="status">Loading emergency data…</p>
                <div className="grid grid-cols-1 gap-5 pt-8 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="flex flex-col gap-3 p-6">
                            <Skeleton className="h-5 w-1/2" />
                            <Skeleton className="h-8 w-1/3" />
                        </Card>
                    ))}
                </div>
                <div className="pt-6">
                    <Card className="flex flex-col gap-3 p-6">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-5 w-full" />
                        ))}
                    </Card>
                </div>
            </PageShell>
        )
    }

    if(loading == false && serverError !== ""){
        return(
            <PageShell width="wide">
                <PageHeader
                    title="Emergency"
                    description="Full breakdown of a recorded emergency."
                />
                <div className="flex flex-col items-start gap-4 pt-8">
                    <Alert tone="danger" className="w-full">{serverError}</Alert>
                    <Button variant="secondary" onClick={()=>getEmergencyData()}>
                        <RefreshIcon size={18} />
                        Retry
                    </Button>
                </div>
            </PageShell>
        )
    }

    {
        return(
            <div ref={rootRef}>
                <PageShell width="wide">
                    <div data-hero>
                        <PageHeader
                            title="Emergency"
                            description={
                                emergencyData ? (
                                    <span className="inline-flex items-center gap-2">
                                        <ClockIcon size={16} className="text-ink-subtle" />
                                        {new Date(emergencyData.startedAt).toLocaleDateString()} —{" "}
                                        {new Date(emergencyData.startedAt).toLocaleTimeString()}
                                    </span>
                                ) : undefined
                            }
                        />
                    </div>

                    <div data-hero className="grid grid-cols-1 gap-5 pt-8 sm:grid-cols-3">
                        {STATS.map(({ icon: StatIcon, label, value }) => (
                            <Card key={label} interactive className="flex flex-col gap-3 p-6">
                                <div className="flex items-center gap-3">
                                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-subtle text-brand-text">
                                        <StatIcon size={22} />
                                    </span>
                                    <h2 className="text-sm font-medium text-ink-muted">{label}</h2>
                                </div>
                                <p className="text-3xl font-semibold text-ink">{value}</p>
                            </Card>
                        ))}
                    </div>

                    <section className="pt-10" data-reveal aria-labelledby="emergency-logs-title">
                        <h2
                            id="emergency-logs-title"
                            className="mb-4 flex items-center gap-2 text-xl font-semibold text-ink"
                        >
                            <FileTextIcon size={20} className="text-brand-text" />
                            Logs
                        </h2>
                        {logsData.length === 0 ? (
                            <EmptyState
                                icon={<FileTextIcon size={24} />}
                                title="No logs available"
                                description="No activity was recorded during this emergency."
                            />
                        ) : (
                            <Card className="overflow-hidden">
                                <ul className="flex max-h-[65dvh] flex-col justify-end overflow-y-auto">
                                    {logsData.map((m,i)=>(
                                        <li
                                            key={i}
                                            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line px-5 py-3 text-sm last:border-b-0"
                                        >
                                            <span className="font-medium text-ink">{m.logMessage}</span>
                                            <span className="text-ink-muted">
                                                {new Date(m.createdAt).toLocaleString()}
                                            </span>
                                            <Badge tone={m.isEmergency ? "danger" : "neutral"}>
                                                {m.logType}
                                            </Badge>
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        )}
                    </section>
                </PageShell>
            </div>
        )
    }
}
