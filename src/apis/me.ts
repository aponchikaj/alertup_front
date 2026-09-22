import { APIS } from "./APIS";
import { get, errorMessage, ApiError, type ApiResponse } from "./http";

export const getMe = async () => {
    try {
        const res = await get<ApiResponse>(APIS.me);
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

/**
 * Auth check that keeps "the server said you are not logged in" separate from
 * "the request never got an answer". Collapsing the two made a cold start or a
 * dropped connection look identical to a logout, so guards signed users out —
 * and could bounce them between /login and /dashboard as requests flapped.
 */
export type AuthState =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { state: "authenticated"; response: ApiResponse; user: any }
    | { state: "unauthenticated" }
    | { state: "error"; message: string };

export const getAuthState = async (): Promise<AuthState> => {
    try {
        const res = await get<ApiResponse>(APIS.me);
        if (!res) return { state: "error", message: "Something went wrong." };
        // A 2xx carrying Success:false is a definitive "not logged in".
        if (res.Success === false) return { state: "unauthenticated" };

        const user = res.user || res.Message?.user || res.Message;
        // Accepts either spelling deliberately. This used to require `_id`,
        // which is MongoDB's field name — after the move to PostgreSQL the API
        // returns `id`, so a perfectly valid session was read as logged-out and
        // the user was bounced back to /login the instant they signed in.
        if (!user || !(user._id || user.id)) return { state: "unauthenticated" };

        return { state: "authenticated", response: res, user };
    } catch (err) {
        if (err instanceof ApiError) {
            if (err.status === 401 || err.status === 403) return { state: "unauthenticated" };
            // status 0 is a network failure or timeout; 5xx is the backend
            // faulting. Neither says anything about the session.
            return { state: "error", message: err.message };
        }
        return { state: "error", message: errorMessage(err) };
    }
};
