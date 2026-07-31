/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { GET_BUILDING_ANALYTICS } from "../../apis/administration"
import { usePageAnimations } from "../../lib/animations"
import { PageHeader, PageShell } from "../../components/ui/layout"
import { Button } from "../../components/ui/button"
import { Card } from "../../components/ui/card"
import { Alert, EmptyState, Skeleton } from "../../components/ui/feedback"
import { TextField } from "../../components/ui/field"
import {
    AlertTriangleIcon,
    ChartIcon,
    ChevronRightIcon,
    ClockIcon,
    RefreshIcon,
} from "../../components/ui/icons"
import { useI18n } from "../../i18n/LanguageProvider"

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
    const rootRef = usePageAnimations()
    const { t } = useI18n()

    const [loading,setLoading] = useState(true)
    const [serverError,setServerError] = useState("")

    const [EMERGENCIES,SET_EMERGENCIES] = useState<EMERGENCY_SCHEMA[]>([])

    const [dateFrom, setDateFrom] = useState<string>("")
    const [dateTo, setDateTo] = useState<string>("")

    // Only the newest request may write state. Two overlapping fetches used to
    // resolve in arbitrary order, so a slower request carrying the previous
    // filters could land last and overwrite the correctly filtered results.
    const requestSeq = useRef(0)

    const getAnalytics = useCallback(async () => {
        const seq = ++requestSeq.current
        setLoading(true)
        setServerError("")
        try{
            const res = await GET_BUILDING_ANALYTICS(buildingId!,{
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined})
            if (seq !== requestSeq.current) return
            if(!res) {setServerError(t("common.error")); return}
            if(res.Success==false) {setServerError(res.Message);return}

            SET_EMERGENCIES(res.Message)
        }catch{
            if (seq !== requestSeq.current) return
            setServerError(t("common.error"))
        }finally{
            if (seq === requestSeq.current) setLoading(false)
        }
    }, [buildingId, dateFrom, dateTo, t])

    useEffect(() => {
        if (!buildingId) return
        getAnalytics()
    }, [buildingId, getAnalytics])

    if(loading==true){
        return(
            <PageShell width="wide">
                <PageHeader
                    title={t("buildings.analytics")}
                    description={t("buildings.analyticsLead")}
                />
                <p className="sr-only" role="status">{t("common.loading")}</p>
                <div className="pt-8">
                    <Card className="flex flex-col gap-4 p-6 sm:flex-row">
                        <Skeleton className="h-11 w-full" />
                        <Skeleton className="h-11 w-full" />
                    </Card>
                </div>
                <div className="grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="flex flex-col gap-3 p-6">
                            <Skeleton className="h-6 w-1/2" />
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-4 w-1/3" />
                        </Card>
                    ))}
                </div>
            </PageShell>
        )
    }

    if(loading==false && serverError !== ""){
        return(
            <PageShell width="wide">
                <PageHeader
                    title={t("buildings.analytics")}
                    description={t("buildings.analyticsLead")}
                />
                <div className="flex flex-col items-start gap-4 pt-8">
                    <Alert tone="danger" className="w-full">{serverError}</Alert>
                    <Button variant="secondary" onClick={getAnalytics}>
                        <RefreshIcon size={18} />
                        {t("common.retry")}
                    </Button>
                </div>
            </PageShell>
        )
    }

    if(loading == false && serverError == ""){
        return(
            <div ref={rootRef}>
                <PageShell width="wide">
                    <div data-hero>
                        <PageHeader
                            title={t("buildings.analytics")}
                            description={t("buildings.analyticsPickLead")}
                        />
                    </div>

                    {
                        EMERGENCIES && (<>
                            <div className="pt-8" data-hero>
                                <Card className="p-6">
                                    <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
                                        <ClockIcon size={18} className="text-brand-text" />
                                        {t("buildings.filterByDate")}
                                    </h2>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <TextField
                                            label={t("buildings.dateFrom")}
                                            type="date"
                                            value={dateFrom}
                                            // The effect above refetches when
                                            // the filter changes; calling
                                            // getAnalytics() here as well fired
                                            // a second request built from the
                                            // pre-update state.
                                            onChange={(e)=>setDateFrom(e.target.value)}
                                        />
                                        <TextField
                                            label={t("buildings.dateTo")}
                                            type="date"
                                            value={dateTo}
                                            onChange={(e)=>setDateTo(e.target.value)}
                                        />
                                    </div>
                                </Card>
                            </div>

                            {
                                EMERGENCIES.length===0 && (
                                    <div className="pt-6">
                                        <EmptyState
                                            icon={<ChartIcon size={24} />}
                                            title={t("buildings.analyticsEmptyTitle")}
                                            description={t("buildings.analyticsEmptyLead")}
                                            action={
                                                <Button
                                                    variant="secondary"
                                                    onClick={()=>{setDateFrom("");setDateTo("");getAnalytics()}}
                                                >
                                                    <RefreshIcon size={18} />
                                                    {t("common.retry")}
                                                </Button>
                                            }
                                        />
                                    </div>
                                )
                            }

                            <ul
                                data-reveal-group
                                className="grid list-none grid-cols-1 gap-5 pt-6 sm:grid-cols-2 lg:grid-cols-3"
                            >
                                {EMERGENCIES.map((e,i)=>(
                                    <li key={i} data-reveal-item className="h-full">
                                        <Card interactive className="h-full">
                                            <Link
                                                to={'/building/'+e.buildingID+'/'+e._id+'/analytics'}
                                                className="group flex h-full flex-col gap-3 rounded-2xl p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger-subtle text-danger-text">
                                                        <AlertTriangleIcon size={22} />
                                                    </span>
                                                    <ChevronRightIcon
                                                        size={18}
                                                        className="text-ink-subtle transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-text"
                                                    />
                                                </div>
                                                <h3 className="text-lg font-semibold text-ink group-hover:text-brand-text">
                                                    {t("buildings.emergency")}
                                                </h3>
                                                <div className="flex flex-col gap-1 text-sm text-ink-muted">
                                                    <span className="flex items-center gap-2">
                                                        <ClockIcon size={15} className="text-ink-subtle" />
                                                        {new Date(e.startedAt).toLocaleDateString()}
                                                    </span>
                                                    <span className="pl-[23px]">
                                                        {new Date(e.startedAt).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </Link>
                                        </Card>
                                    </li>
                                ))}
                            </ul>
                        </>)
                    }
                </PageShell>
            </div>
        )
    }
}
