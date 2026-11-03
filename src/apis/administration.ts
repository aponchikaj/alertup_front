import { APIS } from "./APIS"
import { get, post, errorMessage, type ApiResponse } from "./http"

export const GETBUILDINGLOGS = async (buildingId: string) => {
    try {
        const res = await get<ApiResponse>(`${APIS.administration.getBuildingLogs}/${buildingId}`);
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

export const CLEARBUILDINGLOGS = async (buildingId: string) => {
    try {
        const res = await post<ApiResponse>(`${APIS.administration.clearBuildingLogs}/${buildingId}`, {});
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

/**
 * Turn a building's emergency on or off — explicitly.
 *
 * FX-018: the old client hit a TOGGLE, so a page showing a stale "off" could
 * resolve a live emergency with an "activate" tap. `activate` calls the v2
 * trigger route (idempotent: already-active stays active) and `resolve` the
 * v2 resolve route, so the request always means what the button said.
 */
export const setEmergencyMode = async (
    buildingId: string,
    intent: 'activate' | 'resolve',
    challenge: { token: string; answer: number },
) => {
    const url = intent === 'activate'
        ? APIS.administration.emergencyTrigger(buildingId)
        : APIS.administration.emergencyResolve(buildingId);
    try {
        const res = await post<ApiResponse>(url, { challenge });
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

export const GET_BUILDING_ANALYTICS = async (
    buildingID: string,
    filters?: Record<string, string | number | undefined | null>,
) => {
    try {
        const res = await get<ApiResponse>(APIS.administration.getBuildingAnalytics + buildingID, { params: filters });
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

export const GET_EMERGENCY_DATA = async (data: { buildingID: string; emergencyID: string }) => {
    try {
        const res = await get<ApiResponse>(`${APIS.administration.getEmergencyAnalytics}${data.buildingID}/${data.emergencyID}`);
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}
