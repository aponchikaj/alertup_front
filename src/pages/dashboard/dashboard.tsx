import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard } from "../../apis/dashboard";
import { usePageAnimations } from "../../lib/animations";
import { PageShell, PageHeader } from "../../components/ui/layout";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Alert, Badge, Skeleton } from "../../components/ui/feedback";
import { ButtonLink } from "../../components/ui/button";
import { StatCard, BarChart } from "../../components/ui/charts";
import { DataTable, type Column } from "../../components/ui/table";
import {
  BuildingIcon,
  ChartIcon,
  ClockIcon,
  PlusIcon,
  QrCodeIcon,
  ScanIcon,
  ZapIcon,
} from "../../components/ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";

interface RecentScan {
  buildingName: string | null;
  scannedAt: string | null;
  buildingID: string | null;
}

interface ActivityPoint {
  date: string;
  count: number;
}

interface DashboardData {
  MyBuildings: number;
  scanned: number;
  myBuildingsScanned: number;
  lastScanned: string | null;
  premiumStatus: string;
  premiumExpires: string | null;
  /** Present once the backend ships the richer payload; both are optional so
   *  the page keeps working against an older deploy. */
  recentScans?: RecentScan[];
  scanActivity?: ActivityPoint[];
}

/** `fallback` is passed in so this stays a pure helper outside the component. */
const formatDateTime = (value: string | null, fallback: string) => {
  if (!value) return fallback;
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatDay = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const Dashboard = () => {
  const rootRef = usePageAnimations();
  const { t } = useI18n();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    const getMyDashboard = async () => {
      setLoading(true);
      setServerError("");
      try {
        const res = await getDashboard();
        if (!res) {
          setServerError(t("common.error"));
          return;
        }
        if (res.Success === false) {
          setServerError(res.Message);
          return;
        }
        setDashboard(res.Message);
      } catch {
        setServerError(t("common.error"));
      } finally {
        setLoading(false);
      }
    };

    getMyDashboard();
  }, [t]);

  const activity = dashboard?.scanActivity ?? [];
  const recentScans = dashboard?.recentScans ?? [];
  const isPremium = dashboard != null && dashboard.premiumStatus !== "Free";

  // Built inside the component: the headers and cell fallbacks are translated,
  // so this can no longer be a module-level constant.
  const scanColumns = useMemo<Column<RecentScan>[]>(
    () => [
      {
        key: "building",
        header: t("dashboard.building"),
        render: (row) =>
          row.buildingID ? (
            <Link
              to={`/building/${row.buildingID}`}
              className="font-medium text-brand-text underline-offset-4 hover:underline"
            >
              {row.buildingName || t("dashboard.unknownBuilding")}
            </Link>
          ) : (
            <span className="font-medium text-ink">
              {row.buildingName || t("dashboard.unknownBuilding")}
            </span>
          ),
      },
      {
        key: "scannedAt",
        header: t("dashboard.scanned"),
        render: (row) => formatDateTime(row.scannedAt, t("dashboard.notAvailable")),
        className: "whitespace-nowrap",
      },
    ],
    [t],
  );

  return (
    <div ref={rootRef}>
      <PageShell width="wide">
        <div data-hero>
          <PageHeader
            title={t("dashboard.title")}
            description={t("dashboard.lead")}
            actions={
              <>
                {dashboard && (
                  <Badge tone={isPremium ? "brand" : "neutral"} className="self-center">
                    <ZapIcon size={13} />
                    {dashboard.premiumStatus}
                  </Badge>
                )}
                <ButtonLink to="/new" size="sm">
                  <PlusIcon size={16} />
                  {t("dashboard.newBuilding")}
                </ButtonLink>
              </>
            }
          />
        </div>

        {loading && (
          <div aria-busy="true" aria-label={t("dashboard.loadingAria")} className="pt-8">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <Skeleton className="h-72 rounded-2xl" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          </div>
        )}

        {serverError && (
          <Alert tone="danger" className="mt-8">
            {serverError}
          </Alert>
        )}

        {!loading && !serverError && dashboard && (
          <div className="flex flex-col gap-5 pt-8">
            {/* Stats */}
            <div
              className="grid grid-cols-1 gap-5 animate-fade-up sm:grid-cols-2 lg:grid-cols-4"
            >
              <StatCard
                icon={BuildingIcon}
                label={t("dashboard.myBuildings")}
                value={dashboard.MyBuildings}
                hint={
                  <Link to="/mybuildings" className="hover:text-brand-text hover:underline">
                    {t("dashboard.manageBuildings")}
                  </Link>
                }
              />
              <StatCard
                icon={QrCodeIcon}
                label={t("dashboard.scansOfMyBuildings")}
                value={dashboard.myBuildingsScanned}
                hint={t("dashboard.scansOfMyBuildingsHint")}
              />
              <StatCard
                icon={ScanIcon}
                label={t("dashboard.codesIScanned")}
                value={dashboard.scanned}
                hint={
                  dashboard.lastScanned
                    ? t("dashboard.lastScan", { name: dashboard.lastScanned })
                    : t("dashboard.noScansYet")
                }
              />
              <StatCard
                icon={ZapIcon}
                label={t("dashboard.plan")}
                value={dashboard.premiumStatus}
                hint={
                  dashboard.premiumExpires
                    ? t("dashboard.renews", {
                        date: formatDateTime(
                          dashboard.premiumExpires,
                          t("dashboard.notAvailable"),
                        ),
                      })
                    : t("dashboard.freePlanHint")
                }
              />
            </div>

            {/* Chart + table */}
            <div
              className="grid gap-5 animate-fade-up lg:grid-cols-[1.5fr_1fr]"
              style={{ animationDelay: "120ms" }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{t("dashboard.scanActivity")}</CardTitle>
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-subtle text-brand-text">
                      <ChartIcon size={18} />
                    </span>
                  </div>
                  <CardDescription>{t("dashboard.scanActivityLead")}</CardDescription>
                </CardHeader>
                <CardBody>
                  {activity.length > 0 ? (
                    <BarChart
                      data={activity.map((p) => ({ label: p.date, value: p.count }))}
                      formatTick={formatDay}
                      ariaLabel={t("dashboard.scanActivityAria")}
                    />
                  ) : (
                    <p className="py-10 text-center text-sm text-ink-subtle">
                      {t("dashboard.activityEmpty")}
                    </p>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>{t("dashboard.recentScans")}</CardTitle>
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-subtle text-brand-text">
                      <ClockIcon size={18} />
                    </span>
                  </div>
                  <CardDescription>{t("dashboard.recentScansLead")}</CardDescription>
                </CardHeader>
                <CardBody>
                  <DataTable
                    columns={scanColumns}
                    rows={recentScans}
                    rowKey={(row, i) => `${row.buildingID ?? row.buildingName ?? "scan"}-${i}`}
                    caption={t("dashboard.recentScansCaption")}
                    emptyLabel={t("dashboard.recentScansEmpty")}
                  />
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </PageShell>
    </div>
  );
};

export default Dashboard;
