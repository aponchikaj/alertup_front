import { APIS } from "./APIS"
import { post, errorMessage, failure, type Envelope } from "./http"

export const SendResetCode = async (data: unknown): Promise<Envelope> => {
    try {
        const res = await post<Envelope>(APIS.reset.resetSendCode, data);
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}

export const ResetVerifyCode = async (data: unknown): Promise<Envelope> => {
    try {
        const res = await post<Envelope>(APIS.reset.resetVerifyCode, data);
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}

export const ResetNewPassword = async (data: unknown): Promise<Envelope> => {
    try {
        const res = await post<Envelope>(APIS.reset.resetPassword, data);
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}
