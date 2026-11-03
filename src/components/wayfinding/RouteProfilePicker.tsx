import { useMemo } from "react";
import { Select } from "../ui/select";
import { useI18n } from "../../i18n/LanguageProvider";
import {
  SELECTABLE_ROUTE_PROFILES,
  type SelectableRouteProfile,
} from "./routeProfile";

/* ============================================================================
   RouteProfilePicker — "how do you want to get there?"
   ----------------------------------------------------------------------------
   A native <select> on purpose: on a phone, held one-handed mid-walk, the OS
   picker beats any custom listbox we could build. Four options only — the
   fifth profile (`emergency`) belongs to the evacuation engine, not to the
   visitor.

   The wheelchair option reuses `wayfinding.accessibleRoute` ("Step-free
   route"), which is the phrase the rest of the product already uses for it.
   ========================================================================= */

const PROFILE_LABEL_KEYS: Record<SelectableRouteProfile, string> = {
  walk: "wayfinding.profileWalk",
  wheelchair: "wayfinding.accessibleRoute",
  elevator_first: "wayfinding.profileElevatorFirst",
  min_floor_changes: "wayfinding.profileMinFloorChanges",
};

export interface RouteProfilePickerProps {
  value: SelectableRouteProfile;
  onChange: (profile: SelectableRouteProfile) => void;
  /** True while a refetch is in flight — the route on screen is stale. */
  busy?: boolean;
  className?: string;
}

export const RouteProfilePicker = ({
  value,
  onChange,
  busy = false,
  className,
}: RouteProfilePickerProps) => {
  const { t } = useI18n();

  const options = useMemo(
    () =>
      SELECTABLE_ROUTE_PROFILES.map((profile) => ({
        value: profile,
        label: t(PROFILE_LABEL_KEYS[profile]),
      })),
    [t],
  );

  return (
    <Select
      label={t("wayfinding.profileLabel")}
      hideLabel
      options={options}
      value={value}
      disabled={busy}
      data-testid="route-profile-picker"
      onChange={(event) => onChange(event.target.value as SelectableRouteProfile)}
      className={className}
      selectClassName="h-9 py-0 text-sm"
    />
  );
};

export default RouteProfilePicker;
