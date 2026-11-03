import { APIS } from "./APIS"
import { post, errorMessage, failure, type Envelope } from "./http"
import type { AuthPayload } from "../types/api"

export type AuthResponse = Envelope<AuthPayload>

/** Persist the Safari/iOS fallback token, which http.ts sends as a Bearer header. */
const storeToken = (res: AuthResponse) => {
    const token = res.data?.token;
    if (token) localStorage.setItem('userToken', token);
};

const authenticate = async (url: string, data: unknown): Promise<AuthResponse> => {
    try {
        const res = await post<AuthResponse>(url, data);
        if (!res) return failure('Something went wrong.');
        storeToken(res);
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}

export const RegisterUser = (data: unknown): Promise<AuthResponse> => authenticate(APIS.auth.register, data)

export const LoginUser = (data: unknown): Promise<AuthResponse> => authenticate(APIS.auth.login, data)

export const Login2faUser = (data: unknown): Promise<AuthResponse> => authenticate(APIS.auth.twoFaAuth, data)
