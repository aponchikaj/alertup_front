import { APIS } from "./APIS"
import { post, errorMessage, type ApiResponseLower } from "./http"

// Note: these endpoints return a lowercase { success, message } envelope,
// unlike most of the API which uses { Success, Message }. The callers in
// pages/reset/reset.tsx read the lowercase form, so it is passed through as-is.

export const SendResetCode = async (data: unknown) => {
    try {
        const res = await post<ApiResponseLower>(APIS.reset.resetSendCode, data);
        if (!res) return { success: false, message: "Something went wrong." };
        return res;
    } catch (err) {
        return { success: false, message: errorMessage(err) };
    }
}

export const ResetVerifyCode = async (data: unknown) => {
    try {
        const res = await post<ApiResponseLower>(APIS.reset.resetVerifyCode, data);
        if (!res) return { success: false, message: "Something went wrong." };
        return res;
    } catch (err) {
        return { success: false, message: errorMessage(err) };
    }
}

export const ResetNewPassword = async (data: unknown) => {
    try {
        const res = await post<ApiResponseLower>(APIS.reset.resetPassword, data);
        if (!res) return { success: false, message: "Something went wrong." };
        return res;
    } catch (err) {
        return { success: false, message: errorMessage(err) };
    }
}
