import { APIS } from "./APIS"
import { get, ApiError, failure, type Envelope } from "./http"

/** GET /api/connect — the server clock rides beside the envelope. */
export type ConnectResponse = Envelope & { timestamp?: string }

/**
 * Health probe used by the ServerGate loading screen. Distinguishes
 * "server is slow", "server is down" and "server returned an error", because
 * the gate shows a different message for each.
 */
export const ConnectApis = async (): Promise<ConnectResponse> => {
    try {
        const res = await get<ConnectResponse>(APIS.connectAPI, { timeoutMs: 10000 });
        if (!res) return failure('Something went wrong.');
        return res;
    } catch (error) {
        if (error instanceof ApiError) {
            // status 0 means the request never got a response (timeout / network)
            if (error.status === 0) return failure(error.message);
            return failure(`Server error: ${error.status}`);
        }

        return failure('Connection failed: unknown error');
    }
}
