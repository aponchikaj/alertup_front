/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from "react";
import { getBuilding } from "../../apis/building";
import { getMe } from "../../apis/me";
import { Link, useParams } from "react-router-dom";
import { EMERGENCY_MODE_FUNCTION } from "../../apis/administration";
import { usePageAnimations } from "../../lib/animations";
import { PageHeader, PageShell } from "../../components/ui/layout";
import { Button, ButtonLink } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Alert, Badge, EmptyState, Skeleton } from "../../components/ui/feedback";
import {
  AlertTriangleIcon,
  ChartIcon,
  FileTextIcon,
  LayersIcon,
  MapIcon,
  RouteIcon,
  UserIcon,
} from "../../components/ui/icons";

const Building = () => {
  const rootRef = usePageAnimations();
  const { buildingID } = useParams();

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [buildingData, setBuildingData] = useState<any>(null);
  const [ownerData,setOwnerData] = useState<any>(null)
  const [isOwner, setIsOwner] = useState<boolean>(false);

  const [emergencyMode,setEmergencyMode] = useState("off")
  const EmergencyModeFunction = async()=>{
    try{
      const res = await EMERGENCY_MODE_FUNCTION(buildingData._id)
      // Each branch returns. Without the returns, a falsy `res` fell through to
      // res.Success on the next line and threw.
      if(!res){
        setServerError("Something went wrong while using emergency mode function.")
        return
      }
      if(res.Success==false){
        setServerError(res.Message)
        return
      }

      window.location.reload()
    }catch{
      setServerError("Couldn't use emergency mode function.")
    }
  }

  useEffect(() => {
    const getBuildingData = async () => {
      setLoading(true);
      try {
        const res = await getBuilding({ buildingID: buildingID! });
        // console.log(res)

        if (!res || res.Success === false) {
          setServerError(res?.Message || "Something went wrong.");
          setLoading(false);
          return;
        }

        // Truthy check: comparing against false displayed "on" whenever the
        // field was missing or undefined.
        setEmergencyMode(res.Message.emergencyMode ? "on" : "off")
        setBuildingData(res.Message);
        setOwnerData(res.Owner)

        // Check if current user is the owner
        const meRes = await getMe();

        // Try alternative methods if getMe fails
        let currentUserId = meRes?.user?._id;

        if (!currentUserId && meRes?.Message?._id) {
          currentUserId = meRes.Message._id;
        }

        if (!currentUserId && meRes?.Message?.user?._id) {
          currentUserId = meRes.Message.user._id;
        }

        if (!currentUserId) {
          // Try to get user ID from localStorage token first
          const userToken = localStorage.getItem('userToken');

          if (userToken) {
            try {
              // Decode JWT token to get user ID
              const tokenParts = userToken.split('.');
              if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                currentUserId = payload.userId || payload.userID || payload.user_id || payload._id;
              }
            } catch (error) {
              // Failed to decode JWT token from localStorage
            }
          }

          // If still no user ID, try cookies
          if (!currentUserId) {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
              const [name, value] = cookie.trim().split('=');
              if (name === 'token' || name === 'authToken' || name === 'jwt') {
                try {
                  // Decode JWT token to get user ID
                  const tokenParts = value.split('.');
                  if (tokenParts.length === 3) {
                    const payload = JSON.parse(atob(tokenParts[1]));
                    currentUserId = payload.userId;
                    break;
                  }
                } catch (error) {
                  // Failed to decode JWT token
                }
              }
            }
          }
        }

        if (currentUserId) {
          const isUserOwner = currentUserId === res.Message.owner;
          setIsOwner(isUserOwner);
        } else {
          setIsOwner(false);
        }
      } catch {
        setServerError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    getBuildingData();
  }, [buildingID]);

  return (
    <div ref={rootRef}>
      <PageShell width="wide">
        <div data-hero>
          <PageHeader
            title="Building overview"
            description="Floors, escape maps, scan activity and emergency controls for this building."
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 gap-6 pt-8 lg:grid-cols-3">
            <Card className="flex flex-col gap-4 p-6 lg:col-span-2">
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            </Card>
            <Card className="flex flex-col gap-4 p-6">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-10 w-full" />
            </Card>
            <p className="sr-only" role="status">
              Loading building…
            </p>
          </div>
        )}

        {/* Error */}
        {serverError && (
          <Alert tone="danger" className="mt-8">
            {serverError}
          </Alert>
        )}

        {/* Content */}
        {buildingData && (
          <section
            data-reveal-group
            className="grid grid-cols-1 gap-6 pt-8 lg:grid-cols-3"
          >

            {/* MAIN INFO CARD */}
            <Card data-reveal-item className="p-6 lg:col-span-2">
              <h2 className="mb-1 text-2xl font-semibold text-ink">
                {buildingData.buildingName}
              </h2>

              <p className="mb-6 text-sm text-ink-subtle">
                Last updated: {new Date(buildingData.updatedAt).toLocaleString()}
              </p>

              <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-3">
                <Stat label="Floors" value={buildingData.floors} />
                <Stat label="Global Scans" value={buildingData.globalScans ? buildingData.globalScans.length : null} />
                <Stat label="Maps" value={buildingData.maps ? buildingData.maps.length : null} />
              </div>

              {isOwner && (
                <Button
                  variant="danger"
                  fullWidth
                  className="mt-6"
                  onClick={EmergencyModeFunction}
                >
                  <AlertTriangleIcon size={18} />
                  Emergency mode: {emergencyMode}
                </Button>
              )}
            </Card>

            {/* STATUS CARD */}
            <Card data-reveal-item className="flex flex-col justify-between gap-6 p-6">
              <div>
                <h3 className="mb-4 text-lg font-semibold text-ink">Status</h3>

                <p className="mb-3 flex items-center gap-2 text-sm text-ink-muted">
                  Active:
                  <Badge tone={buildingData.isDeactivated ? "danger" : "success"}>
                    {buildingData.isDeactivated ? "No" : "Yes"}
                  </Badge>
                </p>

                {ownerData && (
                  <p className="text-sm text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <UserIcon size={15} className="text-ink-subtle" />
                      Owner:
                    </span>
                    <span className="mt-1 block break-all font-medium text-ink">
                      {ownerData.displayName}
                    </span>
                  </p>
                )}
                {/* Owner email intentionally not shown: this page is public, so
                    anyone with a building link could harvest the owner's contact
                    details. The API no longer returns it either. */}
              </div>

              <div className="flex flex-col gap-3">
                {isOwner && (
                  <ButtonLink to={`/building/${buildingData._id}/nodes`} fullWidth>
                    <RouteIcon size={18} />
                    Manage emergency routes
                  </ButtonLink>
                )}

                {isOwner && buildingData.emergencyMode == true && (
                  <ButtonLink
                    to={`/building/${buildingData._id}/logs`}
                    variant="secondary"
                    fullWidth
                  >
                    <FileTextIcon size={18} />
                    Check logs
                  </ButtonLink>
                )}

                <ButtonLink
                  to={`/building/${buildingData._id}/analytics`}
                  variant="secondary"
                  fullWidth
                >
                  <ChartIcon size={18} />
                  Analytics
                </ButtonLink>
              </div>
            </Card>

            {/* MAPS SECTION */}
            <Card data-reveal-item className="p-6 lg:col-span-3">
              <h3 className="mb-4 text-lg font-semibold text-ink">Maps</h3>

              {buildingData.maps && buildingData.maps.length === 0 ? (
                <EmptyState
                  icon={<MapIcon size={24} />}
                  title="No maps available"
                  description="Uploaded floor maps will appear here."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {buildingData.maps && buildingData.maps.map((map: any) => (
                    <Link
                      key={map._id}
                      to={`/building/${buildingData._id}/${map.floor}`}
                      className="group flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-4 transition-colors hover:border-brand-border hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-subtle text-brand-text">
                        <LayersIcon size={20} />
                      </span>
                      <span>
                        <span className="block font-semibold text-ink group-hover:text-brand-text">
                          Floor {map.floor}
                        </span>
                        <span className="block text-sm text-ink-subtle">
                          Scans: {map.scanned?.length || 0}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </section>
        )}
      </PageShell>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Stat = ({ label, value }: { label: string; value: any }) => (
  <div className="rounded-xl border border-line bg-surface-2 p-4 text-center">
    <p className="text-sm text-ink-subtle">{label}</p>
    <p className="text-2xl font-bold text-brand-text">{value}</p>
  </div>
);

export default Building;
