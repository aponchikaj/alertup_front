import { useEffect, useState } from "react";
import { deactivateBuilding, deleteBuilding, getMyBuildings } from "../../apis/building";
import { errorMessage } from "../../apis/http";
import { Link } from "react-router-dom";
import { usePageAnimations } from "../../lib/animations";
import { PageHeader, PageShell } from "../../components/ui/Layout";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Alert, Badge, EmptyState, Skeleton } from "../../components/ui/Feedback";
import {
  BuildingIcon,
  ChartIcon,
  LayersIcon,
  MapIcon,
  PlusIcon,
  TrashIcon,
} from "../../components/ui/Icons";
import { useI18n } from "../../i18n/LanguageProvider";
import type { Building, MemberBuilding } from "../../types/api";

const Mybuildings = () => {
  const rootRef = usePageAnimations();
  const { t } = useI18n();
  const [buildings, setBuildings] = useState<Building[]>([]);
  // FX-023 (FE-12): the API already returned these; the page dropped them, so
  // an invited member saw "No buildings yet".
  const [memberBuildings, setMemberBuildings] = useState<MemberBuilding[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null); // track action per building

  useEffect(() => {

    const fetchBuildings = async () => {
      setLoading(true);
      setServerError("");

      try {
        const res = await getMyBuildings();
        if (res.success) {
          setBuildings(res.data ?? []);
          setMemberBuildings(Array.isArray(res.memberBuildings) ? res.memberBuildings : []);
        }
        else setServerError(res.message || t("common.error"));
      } catch (err: unknown) {
        setServerError(errorMessage(err, t("common.error")));
      } finally {
        setLoading(false);
      }
    };

    fetchBuildings();
  }, [t]);

  const handleDeactivationOfBuilding = async (id: string) => {
    const confirm = window.confirm(t("buildings.deactivateConfirm"));
    if (!confirm) return;

    try {
      setActionLoading(id);
      const res = await deactivateBuilding(id);
      if (res.success) {
        setBuildings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, isDeactivated: true } : b))
        );
      } else {
        alert(res.message || t("common.error"));
      }
    } catch (err: unknown) {
      alert(errorMessage(err, t("common.error")));
    } finally {
      setActionLoading(null);
    }
  };

  const handleBuildingDelete = async (id: string) => {
    const confirm = window.confirm(t("buildings.deleteConfirm"));
    if (!confirm) return;

    try {
      setActionLoading(id);
      const res = await deleteBuilding(id);
      if (res.success) {
        setBuildings((prev) => prev.filter((b) => b.id !== id));
      } else {
        alert(res.message || t("common.error"));
      }
    } catch (err: unknown) {
      alert(errorMessage(err, t("common.error")));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div ref={rootRef}>
      <PageShell width="wide">
        <div data-hero>
          <PageHeader
            title={t("buildings.myTitle")}
            description={t("buildings.myLead")}
            actions={
              <ButtonLink to="/new">
                <PlusIcon size={18} />
                {t("buildings.createTitle")}
              </ButtonLink>
            }
          />
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-6 pt-8 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="flex flex-col gap-4 p-6">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </Card>
            ))}
            <p className="sr-only" role="status">
              {t("common.loading")}
            </p>
          </div>
        )}

        {serverError && (
          <Alert tone="danger" className="mt-8">
            {serverError}
          </Alert>
        )}

        {!loading && !serverError && buildings.length === 0 && memberBuildings.length === 0 && (
          <div className="pt-8">
            <EmptyState
              icon={<BuildingIcon size={24} />}
              title={t("buildings.emptyTitle")}
              description={t("buildings.emptyLead")}
              action={
                <ButtonLink to="/new">
                  <PlusIcon size={18} />
                  {t("buildings.createTitle")}
                </ButtonLink>
              }
            />
          </div>
        )}

        <ul
          data-reveal-group
          className="grid list-none grid-cols-1 gap-6 pt-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {buildings.map((b) => (
            <li key={b.id} data-reveal-item className="h-full">
              <Card interactive className="flex h-full flex-col gap-4 p-6">
                <Link
                  to={`/building/${b.id}`}
                  className="group flex flex-col gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-subtle text-brand-text">
                      <BuildingIcon size={22} />
                    </span>
                    <Badge tone={b.isDeactivated ? "danger" : "success"}>
                      {b.isDeactivated
                        ? t("buildings.deactivated")
                        : t("buildings.active")}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-semibold text-ink group-hover:text-brand-text">
                    {b.buildingName}
                  </h2>
                  <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
                    <li className="flex items-center gap-2">
                      <LayersIcon size={16} className="text-ink-subtle" />
                      <span className="font-medium text-ink">{t("buildings.floors")}</span>{" "}
                      {b.floors}
                    </li>
                    <li className="flex items-center gap-2">
                      <MapIcon size={16} className="text-ink-subtle" />
                      <span className="font-medium text-ink">
                        {t("buildings.mapsUploaded")}
                      </span>{" "}
                      {b.maps.length}
                    </li>
                    <li className="flex items-center gap-2">
                      <ChartIcon size={16} className="text-ink-subtle" />
                      <span className="font-medium text-ink">
                        {t("buildings.globalScans")}
                      </span>{" "}
                      {b.globalScans.length}
                    </li>
                  </ul>
                </Link>

                <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => handleDeactivationOfBuilding(b.id)}
                    disabled={actionLoading === b.id || b.isDeactivated}
                    loading={actionLoading === b.id}
                    loadingLabel={t("buildings.working")}
                  >
                    {t("buildings.deactivate")}
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth
                    onClick={() => handleBuildingDelete(b.id)}
                    disabled={actionLoading === b.id}
                    loading={actionLoading === b.id}
                    loadingLabel={t("buildings.working")}
                  >
                    <TrashIcon size={16} />
                    {t("common.delete")}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        {memberBuildings.length > 0 && (
          <section aria-labelledby="shared-buildings" className="pt-12">
            <h2 id="shared-buildings" className="text-xl font-semibold text-ink">
              {t("buildings.sharedWithMe")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t("buildings.sharedWithMeLead")}</p>
            <ul className="grid list-none grid-cols-1 gap-6 pt-6 sm:grid-cols-2 lg:grid-cols-3">
              {memberBuildings.map((b) => (
                <li key={b.id} className="h-full">
                  <Card interactive className="flex h-full flex-col gap-3 p-6">
                    <Link
                      to={`/building/${b.id}`}
                      className="group flex flex-col gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-subtle text-brand-text">
                          <BuildingIcon size={22} />
                        </span>
                        <Badge tone="neutral">{b.role}</Badge>
                      </div>
                      <h3 className="text-lg font-semibold text-ink group-hover:text-brand-text">
                        {b.buildingName}
                      </h3>
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageShell>
    </div>
  );
};

export default Mybuildings;
