import { useEffect, useState } from "react";
import { createNewBuilding } from "../../apis/building";
import { useNavigate } from "react-router-dom";
import { getMe } from "../../apis/me";
import { usePageAnimations } from "../../lib/animations";
import { PageHeader, PageShell } from "../../components/ui/layout";
import { Button, ButtonLink } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Alert } from "../../components/ui/feedback";
import { TextField } from "../../components/ui/field";
import { ArrowRightIcon, MailIcon } from "../../components/ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";

/* ============================================================================
   New building
   ----------------------------------------------------------------------------
   One step: a name and a floor count, then straight into the map editor.

   This used to be a two-step wizard that demanded an image for every floor
   before it would create anything — so you had to go and find plans before you
   could even make the building, and the editor (where plans are actually
   useful) was somewhere you had to discover separately. Floor plans are
   optional here now: the editor draws an empty floor perfectly well, and its
   floor panel takes an image whenever you have one.
   ========================================================================= */

const MAX_FLOORS = 200;

const NewBuilding = () => {
  const rootRef = usePageAnimations();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  /** null = still checking; false = logged in but email not verified. */
  const [verified, setVerified] = useState<boolean | null>(null);

  const [buildingName, setBuildingName] = useState("");
  const [floors, setFloors] = useState(1);

  useEffect(() => {
    const checkVerification = async () => {
      const res = await getMe();
      if (!res || res.Success === false) {
        navigate("/login");
        return;
      }
      // Unverified accounts see an explanation rather than a silent bounce to
      // /settings, which read as a broken "New" button.
      setVerified(res.Message?.verified === true);
    };
    checkVerification();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildingName.trim()) {
      setServerError(t("buildings.createNameRequired"));
      return;
    }

    setServerError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("buildingName", buildingName.trim());
      formData.append("floors", String(floors));
      // Named for the visitor, not the database: "Floor 1" reads correctly on a
      // printed sign. Renameable in the editor.
      for (let i = 1; i <= floors; i++) {
        formData.append("floorNames[]", t("wayfinding.floor", { number: i }));
      }

      const res = await createNewBuilding(formData);
      if (!res || res.Success === false) {
        setServerError(res?.Message || t("buildings.createFailed"));
        setLoading(false);
        return;
      }

      // Straight into the editor — that is the point of creating a building.
      const buildingId = res.buildingID || res.Message?.buildingID;
      if (buildingId) {
        navigate(`/building/${buildingId}/nodes`, { replace: true });
        return;
      }
      // No id came back: the building exists, so send them somewhere useful
      // rather than stranding them on a form that looks like it failed.
      navigate("/mybuildings", { replace: true });
    } catch {
      setServerError(t("buildings.createFailed"));
      setLoading(false);
    }
  };

  return (
    <div ref={rootRef}>
      <PageShell>
        <div data-hero>
          <PageHeader
            title={t("buildings.createTitle")}
            description={t("buildings.createLead")}
          />
        </div>

        {verified === false && (
          <div className="pt-8" data-reveal>
            <Card className="mx-auto w-full max-w-xl p-6 text-center sm:p-8">
              <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-warning-subtle text-warning-text">
                <MailIcon size={26} />
              </span>
              <h2 className="text-xl font-semibold text-ink">
                {t("buildings.verifyTitle")}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                {t("buildings.verifyLead")}
              </p>
              <div className="mt-6 flex justify-center">
                <ButtonLink to="/settings">
                  {t("buildings.goToVerification")}
                </ButtonLink>
              </div>
            </Card>
          </div>
        )}

        {verified !== false && (
          <div className="pt-8" data-reveal>
            <Card className="mx-auto w-full max-w-xl p-6 sm:p-8">
              {serverError && (
                <Alert tone="danger" className="mb-5">
                  {serverError}
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <TextField
                  label={t("buildings.buildingName")}
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  autoFocus
                  required
                />

                <TextField
                  label={t("buildings.numberOfFloors")}
                  type="number"
                  min={1}
                  max={MAX_FLOORS}
                  value={floors}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    // Guards the empty field (NaN) as well as silly values.
                    setFloors(
                      Number.isFinite(value)
                        ? Math.min(MAX_FLOORS, Math.max(1, Math.trunc(value)))
                        : 1,
                    );
                  }}
                  hint={t("buildings.createFloorsHint", { count: floors })}
                  required
                />

                <Button
                  type="submit"
                  fullWidth
                  className="mt-1"
                  loading={loading}
                  loadingLabel={t("buildings.working")}
                >
                  {t("buildings.createCta")}
                  <ArrowRightIcon size={18} />
                </Button>
              </form>
            </Card>
          </div>
        )}
      </PageShell>
    </div>
  );
};

export default NewBuilding;
