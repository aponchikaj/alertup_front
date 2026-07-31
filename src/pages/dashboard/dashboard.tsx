import { useEffect, useState } from "react";
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

const formatDateTime = (value: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatDay = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const SCAN_COLUMNS: Column<RecentScan>[] = [
  {
    key: "building",
    header: "Building",
    render: (row) =>
      row.buildingID ? (
        <Link
          to={`/building/${row.buildingID}`}
          className="font-medium text-brand-text underline-offset-4 hover:underline"
        >
          {row.buildingName || "Unknown building"}
        </Link>
      ) : (
        <span className="font-medium text-ink">{row.buildingName || "Unknown building"}</span>
      ),
  },
  {
    key: "scannedAt",
    header: "Scanned",
    render: (row) => formatDateTime(row.scannedAt),
    className: "whitespace-nowrap",
  },
];

const Dashboard = () => {
  const rootRef = usePageAnimations();
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
          setServerError("Something went wrong.");
          return;
        }
        if (res.Success === false) {
          setServerError(res.Message);
          return;
        }
        setDashboard(res.Message);
      } catch {
        setServerError("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    getMyDashboard();
  }, []);

  const activity = dashboard?.scanActivity ?? [];
  const recentScans = dashboard?.recentScans ?? [];
  const isPremium = dashboard != null && dashboard.premiumStatus !== "Free";

  return (
    <div ref={rootRef}>
      <PageShell width="wide">
        <div data-hero>
          <PageHeader
            title="Your dashboard"
            description="Overview of your buildings, scans, and activity."
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
                  New building
                </ButtonLink>
              </>
            }
          />
        </div>

        {loading && (
          <div aria-busy="true" aria-label="Loading dashboard" className="pt-8">
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
                label="My buildings"
                value={dashboard.MyBuildings}
                hint={
                  <Link to="/mybuildings" className="hover:text-brand-text hover:underline">
                    Manage buildings →
                  </Link>
                }
              />
              <StatCard
                icon={QrCodeIcon}
                label="Scans of my buildings"
                value={dashboard.myBuildingsScanned}
                hint="Total QR scans across all your buildings"
              />
              <StatCard
                icon={ScanIcon}
                label="Codes I scanned"
                value={dashboard.scanned}
                hint={
                  dashboard.lastScanned
                    ? `Last: ${dashboard.lastScanned}`
                    : "You haven't scanned a code yet"
                }
              />
              <StatCard
                icon={ZapIcon}
                label="Plan"
                value={dashboard.premiumStatus}
                hint={
                  dashboard.premiumExpires
                    ? `Renews ${formatDateTime(dashboard.premiumExpires)}`
                    : "Free plan — first building included"
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
                    <CardTitle>Scan activity</CardTitle>
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-subtle text-brand-text">
                      <ChartIcon size={18} />
                    </span>
                  </div>
                  <CardDescription>
                    Codes you scanned over the last 14 days.
                  </CardDescription>
                </CardHeader>
                <CardBody>
                  {activity.length > 0 ? (
                    <BarChart
                      data={activity.map((p) => ({ label: p.date, value: p.count }))}
                      formatTick={formatDay}
                      ariaLabel="Scans per day over the last 14 days"
                    />
                  ) : (
                    <p className="py-10 text-center text-sm text-ink-subtle">
                      Activity will appear here once scans start coming in.
                    </p>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Recent scans</CardTitle>
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-subtle text-brand-text">
                      <ClockIcon size={18} />
                    </span>
                  </div>
                  <CardDescription>Your latest scanned codes.</CardDescription>
                </CardHeader>
                <CardBody>
                  <DataTable
                    columns={SCAN_COLUMNS}
                    rows={recentScans}
                    rowKey={(row, i) => `${row.buildingID ?? row.buildingName ?? "scan"}-${i}`}
                    caption="Your most recent QR code scans"
                    emptyLabel="No scans yet — point your camera at an AlertUp code."
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
