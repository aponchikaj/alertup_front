import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CLEARBUILDINGLOGS, GETBUILDINGLOGS } from '../../apis/administration'
import { usePageAnimations } from '../../lib/animations'
import { PageHeader, PageShell } from '../../components/ui/layout'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Alert, Badge, EmptyState, Skeleton } from '../../components/ui/feedback'
import { FileTextIcon, RefreshIcon, TrashIcon } from '../../components/ui/icons'

interface LOG_SCHEMA{
    logMessage:string,
    logType:string,
    isEmergency:boolean,
    createdAt:string,
    buildingID:string
}

export default function Logs(){

    const rootRef = usePageAnimations()
    const [LOGS,setLOGS] = useState<Array<LOG_SCHEMA>>([])
    const [serverError,setServerError] = useState("")
    const [loading,setLoading] = useState(true)
    const {buildingId} = useParams()
    const fetchLogs = async()=>{
        try{
            const res = await GETBUILDINGLOGS(buildingId!)
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
            // Cleared on success. Without this, one failed poll left the error
            // screen up permanently — during an emergency, a single network
            // blip replaced the live log feed for good even though every
            // subsequent poll succeeded.
            setServerError("")
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
            const res = await CLEARBUILDINGLOGS(buildingId!)
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
        <div ref={rootRef}>
            <PageShell width="wide">
                <div data-hero>
                    <PageHeader
                        title="Logs"
                        description="Live activity for this building — the feed refreshes every 10 seconds."
                        actions={
                            <>
                                <Button variant="secondary" onClick={fetchLogs} title="Refresh">
                                    <RefreshIcon size={18} />
                                    Refresh
                                </Button>
                                <Button variant="danger" onClick={clearLogs}>
                                    <TrashIcon size={16} />
                                    Clear
                                </Button>
                            </>
                        }
                    />
                </div>

                <div className="pt-8" data-reveal>
                    {loading && serverError === "" && (
                        <Card className="flex flex-col gap-3 p-6">
                            <p className="sr-only" role="status">Loading logs…</p>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-5 w-full" />
                            ))}
                        </Card>
                    )}

                    {!loading && serverError !== "" && (
                        <Alert tone="danger">{serverError}</Alert>
                    )}

                    {!loading && serverError === "" && (
                        LOGS && LOGS.length > 0 ? (
                            <Card className="overflow-hidden">
                                <ul className="flex h-[65dvh] flex-col justify-end gap-0 overflow-y-auto">
                                    {LOGS.map((m, i) => (
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
                        ) : (
                            <EmptyState
                                icon={<FileTextIcon size={24} />}
                                title="No logs yet"
                                description="Activity for this building will appear here as it happens."
                            />
                        )
                    )}
                </div>
            </PageShell>
        </div>
    )
}
