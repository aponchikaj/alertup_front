import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CLEARBUILDINGLOGS, GETBUILDINGLOGS } from '../../apis/administration'
import { usePageAnimations } from '../../lib/animations'
import { PageHeader, PageShell } from '../../components/ui/Layout'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Alert, Badge, EmptyState, Skeleton } from '../../components/ui/Feedback'
import { FileTextIcon, RefreshIcon, TrashIcon } from '../../components/ui/Icons'
import { useI18n } from '../../i18n/LanguageProvider'
import { createBuildingChannel } from '../../lib/realtime'
import type { LogEntry } from '../../types/api'

export default function Logs(){

    const rootRef = usePageAnimations()
    const { t } = useI18n()
    const [LOGS,setLOGS] = useState<Array<LogEntry>>([])
    const [serverError,setServerError] = useState("")
    const [loading,setLoading] = useState(true)
    const {buildingId} = useParams()
    const fetchLogs = async()=>{
        try{
            const res = await GETBUILDINGLOGS(buildingId!)
            if(!res) {
                setServerError(t("common.error"))
                setLoading(false)
                return;
            }
            if(!res.success) {
                setServerError(res.message);
                setLoading(false)
                return;
            }
            setLOGS(res.data ?? [])
            // Cleared on success. Without this, one failed poll left the error
            // screen up permanently — during an emergency, a single network
            // blip replaced the live log feed for good even though every
            // subsequent poll succeeded.
            setServerError("")
            setLoading(false)
        }catch{
            setServerError(t("common.error"))
            setLoading(false)
            return;
        }
    }

    // FX-058: follow the building's member feed. A new log line (or a
    // catch-up signal after a reconnect) refreshes the list at once; the 10 s
    // poll runs only while the live connection is degraded — e.g. Safari,
    // which blocks the cross-site cookie the stream needs.
    useEffect(()=>{
        if (!buildingId) return
        fetchLogs()
        const channel = createBuildingChannel(buildingId, { feed: true })
        const REFRESH_ON = new Set(["log_appended", "state", "resync_required", "emergency_started", "emergency_ended"])
        const unsubscribe = channel.subscribe((evt) => {
            if (REFRESH_ON.has(evt.type)) fetchLogs()
        })
        let interval: ReturnType<typeof setInterval> | null = null
        const offStatus = channel.onStatusChange((status) => {
            if (status === "degraded" && !interval) {
                interval = setInterval(() => { fetchLogs() }, 10000)
            } else if (status !== "degraded" && interval) {
                clearInterval(interval)
                interval = null
            }
        })
        return () => {
            unsubscribe()
            offStatus()
            if (interval) clearInterval(interval)
            channel.close()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[buildingId])

    const clearLogs = async()=>{
        setLoading(true)
        try{
            const res = await CLEARBUILDINGLOGS(buildingId!)
            if(!res) {
                setServerError(t("common.error"))
                setLoading(false)
                return;
            }
            if(!res.success) {
                setServerError(res.message);
                setLoading(false)
                return;
            }
            // Re-fetch instead of reloading the whole page (FX-058).
            await fetchLogs()
        }catch{
            setServerError(t("common.error"))
            setLoading(false)
            return;
        }
    }

    return(
        <div ref={rootRef}>
            <PageShell width="wide">
                <div data-hero>
                    <PageHeader
                        title={t("buildings.logs")}
                        description={t("buildings.logsLead")}
                        actions={
                            <>
                                <Button variant="secondary" onClick={fetchLogs} title={t("common.refresh")}>
                                    <RefreshIcon size={18} />
                                    {t("common.refresh")}
                                </Button>
                                <Button variant="danger" onClick={clearLogs}>
                                    <TrashIcon size={16} />
                                    {t("buildings.clearLogs")}
                                </Button>
                            </>
                        }
                    />
                </div>

                <div className="pt-8" data-reveal>
                    {loading && serverError === "" && (
                        <Card className="flex flex-col gap-3 p-6">
                            <p className="sr-only" role="status">{t("common.loading")}</p>
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
                                title={t("buildings.logsEmptyTitle")}
                                description={t("buildings.logsEmptyLead")}
                            />
                        )
                    )}
                </div>
            </PageShell>
        </div>
    )
}
