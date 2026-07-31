import { APIS } from "./APIS"
import { get, ApiError, type ApiResponse } from "./http"

/**
 * Health probe used by the ServerGate loading screen. Distinguishes
 * "server is slow", "server is down" and "server returned an error", because
 * the gate shows a different message for each.
 */
export const ConnectApis = async () => {
    try {
        const res = await get<ApiResponse>(APIS.connectAPI, { timeoutMs: 10000 });
        if (!res) return { Success: false, Message: 'Something went wrong.' };
        return res;
    } catch (error) {
        console.error("ConnectApis error:", error);

        if (error instanceof ApiError) {
            // status 0 means the request never got a response (timeout / network)
            if (error.status === 0) return { Success: false, Message: error.message };
            return { Success: false, Message: `Server error: ${error.status}` };
        }

        return { Success: false, Message: 'Connection failed: unknown error' };
    }
}
