import { APIS } from "./APIS"
import { post, errorMessage } from "./http"

interface AuthResponse {
    Success: boolean;
    Message: string;
    token?: string;
    user?: unknown;
    /** Standardised envelope payload; carries token/user on newer backends. */
    data?: { token?: string; user?: unknown };
}

/**
 * Lift `token` and `user` to the top level.
 *
 * The API moved them inside `data` when the response envelope was
 * standardised. Callers (and the screens behind them) still read them from the
 * top level, so both shapes are accepted here rather than at every call site.
 */
const liftPayload = (res: AuthResponse): AuthResponse => {
    if (!res?.data) return res;
    return {
        ...res,
        token: res.token ?? res.data.token,
        user: res.user ?? res.data.user,
    };
};

/** Persist the Safari/iOS fallback token, which http.ts sends as a Bearer header. */
const storeToken = (res: AuthResponse) => {
    if (res?.token) localStorage.setItem('userToken', res.token);
};

export const RegisterUser = async (data: unknown) => {
    try {
        const res = await post<AuthResponse>(APIS.auth.register, data);
        if (!res) return { Success: false, Message: 'Something went wrong.' };
        const lifted = liftPayload(res);
        storeToken(lifted);
        return lifted;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

export const LoginUser = async (data: unknown) => {
    try {
        const res = await post<AuthResponse>(APIS.auth.login, data);
        if (!res) return { Success: false, Message: 'Something went wrong.' };
        const lifted = liftPayload(res);
        storeToken(lifted);
        return lifted;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

export const Login2faUser = async (data: unknown) => {
    try {
        const res = await post<AuthResponse>(APIS.auth.twoFaAuth, data);
        if (!res) return { Success: false, Message: "Something went wrong." };
        const lifted = liftPayload(res);
        storeToken(lifted);
        return lifted;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}
