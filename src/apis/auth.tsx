import { APIS } from "./APIS"
import { post, errorMessage } from "./http"

interface AuthResponse {
    Success: boolean;
    Message: string;
    token?: string;
    user?: unknown;
}

/** Persist the Safari/iOS fallback token, which http.ts sends as a Bearer header. */
const storeToken = (res: AuthResponse) => {
    if (res?.token) localStorage.setItem('userToken', res.token);
};

export const RegisterUser = async (data: unknown) => {
    try {
        const res = await post<AuthResponse>(APIS.auth.register, data);
        if (!res) return { Success: false, Message: 'Something went wrong.' };
        storeToken(res);
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

export const LoginUser = async (data: unknown) => {
    try {
        const res = await post<AuthResponse>(APIS.auth.login, data);
        if (!res) return { Success: false, Message: 'Something went wrong.' };
        storeToken(res);
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

export const Login2faUser = async (data: unknown) => {
    try {
        const res = await post<AuthResponse>(APIS.auth.twoFaAuth, data);
        if (!res) return { Success: false, Message: "Something went wrong." };
        storeToken(res);
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}
