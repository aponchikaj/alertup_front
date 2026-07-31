import { APIS } from "./APIS"
import { post, errorMessage, type ApiResponse } from "./http"

export const enable2fa = async () => {
    try {
        const res = await post<ApiResponse>(APIS.twoFactorAuth.activate2fa);
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

export const deactivate2fa = async () => {
    try {
        const res = await post<ApiResponse>(APIS.twoFactorAuth.deactivate2fa);
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

export const verify2fa = async (data: unknown) => {
    try {
        const res = await post<ApiResponse>(APIS.twoFactorAuth.verify2fa, data);
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}
