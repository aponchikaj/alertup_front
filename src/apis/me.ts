import { APIS } from "./APIS";
import { get, errorMessage, failure, ApiError, type Envelope } from "./http";
import type { MeUser } from "../auth/authContext";

export const getMe = async (): Promise<Envelope<MeUser>> => {
    try {
        const res = await get<Envelope<MeUser>>(APIS.me);
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}

/**
 * Auth check that keeps "the server said you are not logged in" separate from
 * "the request never got an answer". Collapsing the two made a cold start or a
 * dropped connection look identical to a logout, so guards signed users out —
 * and could bounce them between /login and /dashboard as requests flapped.
 */
export type AuthState =
    | { state: "authenticated"; user: MeUser }
    | { state: "unauthenticated" }
    | { state: "error"; message: string };

export const getAuthState = async (): Promise<AuthState> => {
    try {
        const res = await get<Envelope<MeUser>>(APIS.me);
        if (!res) return { state: "error", message: "Something went wrong." };
        // A 2xx carrying success:false is a definitive "not logged in".
        if (res.success === false) return { state: "unauthenticated" };

        // This used to require `_id`, MongoDB's field name — after the move to
        // PostgreSQL the API returns `id`, so a perfectly valid session was
        // read as logged-out and the user bounced back to /login on sign-in.
        const user = res.data;
        if (!user || !user.id) return { state: "unauthenticated" };

        return { state: "authenticated", user };
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
