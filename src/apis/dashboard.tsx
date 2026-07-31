import { APIS } from "./APIS"
import { get, errorMessage, type ApiResponse } from "./http"

export const getDashboard = async () => {
    try {
        const res = await get<ApiResponse>(APIS.getDashboard);
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}
