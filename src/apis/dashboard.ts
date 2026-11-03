import { APIS } from "./APIS"
import { get, errorMessage, failure, type Envelope } from "./http"
import type { DashboardData } from "../types/api"

export const getDashboard = async (): Promise<Envelope<DashboardData>> => {
    try {
        const res = await get<Envelope<DashboardData>>(APIS.getDashboard);
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}
