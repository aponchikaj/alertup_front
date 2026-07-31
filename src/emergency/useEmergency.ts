import { useContext } from "react";
import { EmergencyContext, type EmergencyContextValue } from "./EmergencyProvider";

/**
 * Emergency state for the current building. Returns null outside a provider,
 * so components that can render on both public and building-scoped pages do
 * not have to be conditionally mounted.
 */
export function useEmergency(): EmergencyContextValue | null {
  return useContext(EmergencyContext);
}

export default useEmergency;
