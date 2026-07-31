import { useEffect, useState } from "react";
import { createNewBuilding } from "../../apis/building";
import { useNavigate } from "react-router-dom";
import { getMe } from "../../apis/me";
import { usePageAnimations } from "../../lib/animations";
import { PageHeader, PageShell } from "../../components/ui/layout";
import { Button, ButtonLink } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Alert } from "../../components/ui/feedback";
import { Field, TextField } from "../../components/ui/field";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MailIcon,
  PlusIcon,
} from "../../components/ui/icons";

interface BuildingSchema {
  buildingName: string;
  floors: number;
  floorNames: string[];
  maps: File[];
}

const NewBuilding = () => {
  const rootRef = usePageAnimations();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  /** null = still checking; false = logged in but email not verified. */
  const [verified, setVerified] = useState<boolean | null>(null);

  const [buildingData, setBuildingData] = useState<BuildingSchema>({
    buildingName: "",
    floors: 1,
    floorNames: [],
    maps: [],
  });

  const checkVerification = async () => {
    const res = await getMe();
    if (!res || res.Success == false) {
      navigate("/login");
      return;
    }
    // Unverified accounts see an explanation instead of being silently
    // bounced to /settings — that redirect read as a broken "New" button.
    // Requires an explicit true. `!== false` treated a missing field — which is
    // what a string error Message yields — as verified.
    setVerified(res.Message?.verified === true);
  };

  /* ----------------------------------
     PAGE SETUP - NO PREMIUM RESTRICTIONS
  ----------------------------------- */
  useEffect(() => {
    checkVerification()
    // No premium checks - unlimited access for all users
  }, []);

  /* ----------------------------------
     KEEP FLOORS / ARRAYS IN SYNC
  ----------------------------------- */
  useEffect(() => {
    setBuildingData((prev) => ({
      ...prev,
      floorNames: prev.floorNames.slice(0, prev.floors),
      maps: prev.maps.slice(0, prev.floors),
    }));
  }, [buildingData.floors]);

  /* ----------------------------------
     FILE HANDLER
  ----------------------------------- */
  const handleFileChange = (index: number, file: File) => {
    const newMaps = [...buildingData.maps];
    newMaps[index] = file;
    setBuildingData({ ...buildingData, maps: newMaps });
  };

  /* ----------------------------------
     STEP CONTROL
  ----------------------------------- */
  const goNext = () => {
    if (!buildingData.buildingName.trim()) {
      setServerError("Building name is required.");
      return;
    }
    setServerError("");
    setStep(2);
  };

  const goBack = () => {
    setStep(1);
  };

  /* ----------------------------------
     SUBMIT
  ----------------------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setLoading(true);

    try {
        const formData = new FormData();
        formData.append("buildingName", buildingData.buildingName);
        formData.append("floors", buildingData.floors.toString());

        buildingData.floorNames.forEach((name) => {
        formData.append("floorNames[]", name); // must append each floor name
        });

        buildingData.maps.forEach((file) => {
        if (file) formData.append("maps", file); // append each map file
        });

        const res = await createNewBuilding(formData); // FormData: the browser sets the multipart boundary
        if (!res || res.Success === false) {
        setServerError(res?.Message || "Something went wrong.");
        setLoading(false);
        return;
        }

        navigate("/mybuildings");
    } catch (err) {
        setServerError("Couldn't create new building.");
        setLoading(false);
    }
    };


  /* ----------------------------------
     FLOOR INPUTS
  ----------------------------------- */
  const renderFloorInputs = () => {
    return Array.from({ length: buildingData.floors }).map((_, i) => (
      <fieldset
        key={i}
        className="flex flex-col gap-4 rounded-xl border border-line bg-surface-2 p-4"
      >
        <legend className="px-1.5 text-sm font-semibold text-ink">
          Floor {i + 1}
        </legend>
        <TextField
          label={`Floor ${i + 1} name`}
          value={buildingData.floorNames[i] || ""}
          onChange={(e) => {
            const names = [...buildingData.floorNames];
            names[i] = e.target.value;
            setBuildingData({ ...buildingData, floorNames: names });
          }}
          required
        />

        <Field label={`Floor ${i + 1} map`} required hint="Image of the escape route map for this floor.">
          {({ id, describedBy }) => (
            <input
              id={id}
              type="file"
              accept="image/*"
              aria-describedby={describedBy}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileChange(i, e.target.files[0]);
                }
              }}
              required
              className="w-full cursor-pointer rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink-muted transition-colors file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-text hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          )}
        </Field>
      </fieldset>
    ));
  };

  /* ----------------------------------
     RENDER
  ----------------------------------- */
  return (
    <div ref={rootRef}>
      <PageShell>
        <div data-hero>
          <PageHeader
            title="Create building"
            description="Name your building, then upload an escape map for every floor — unlimited floors available."
          />
        </div>

        {/* Unverified accounts get an explanation and a path forward instead
            of a silent redirect. */}
        {verified === false && (
          <div className="pt-8" data-reveal>
            <Card className="mx-auto w-full max-w-xl p-6 text-center sm:p-8">
              <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-warning-subtle text-warning-text">
                <MailIcon size={26} />
              </span>
              <h2 className="text-xl font-semibold text-ink">
                Verify your email first
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                Adding a building publishes safety information other people
                rely on, so we ask you to confirm your email address before
                creating one. It takes under a minute in Settings.
              </p>
              <div className="mt-6 flex justify-center">
                <ButtonLink to="/settings">Go to verification</ButtonLink>
              </div>
            </Card>
          </div>
        )}

        {verified !== false && (
        <div className="pt-8" data-reveal>
          <Card className="mx-auto w-full max-w-xl p-6 sm:p-8">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-text">
              Step {step} of 2
            </p>

            {serverError && (
              <Alert tone="danger" className="mb-5">
                {serverError}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* STEP 1 */}
              {step === 1 && (
                <>
                  <TextField
                    label="Building name"
                    value={buildingData.buildingName}
                    onChange={(e) =>
                      setBuildingData({
                        ...buildingData,
                        buildingName: e.target.value,
                      })
                    }
                    required
                  />

                  <TextField
                    label="Number of floors"
                    type="number"
                    min={1}
                    value={buildingData.floors}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setBuildingData({
                        ...buildingData,
                        floors: Math.max(1, value),
                      });
                    }}
                    required
                  />

                  <Button type="button" onClick={goNext} fullWidth className="mt-2">
                    Next
                    <ArrowRightIcon size={18} />
                  </Button>
                </>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <>
                  {renderFloorInputs()}

                  <div className="mt-2 flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={goBack}
                      fullWidth
                    >
                      <ArrowLeftIcon size={18} />
                      Back
                    </Button>

                    <Button
                      type="submit"
                      fullWidth
                      loading={loading}
                      loadingLabel="Creating…"
                    >
                      <PlusIcon size={18} />
                      Create
                    </Button>
                  </div>
                </>
              )}
            </form>
          </Card>
        </div>
        )}
      </PageShell>
    </div>
  );
};

export default NewBuilding;
