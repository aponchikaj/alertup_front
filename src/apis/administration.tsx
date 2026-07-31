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

export const EMERGENCY_MODE_FUNCTION = async (buildingID: string) => {
    try {
        const res = await post<ApiResponse>(APIS.administration.emergencyMode, { buildingID });
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
