import { APIS } from "./APIS"
import { post, errorMessage, failure, type Envelope } from "./http"

export const enable2fa = async (): Promise<Envelope> => {
    try {
        const res = await post<Envelope>(APIS.twoFactorAuth.activate2fa);
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}

export const deactivate2fa = async (): Promise<Envelope> => {
    try {
        const res = await post<Envelope>(APIS.twoFactorAuth.deactivate2fa);
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}

export const verify2fa = async (data: unknown): Promise<Envelope> => {
    try {
        const res = await post<Envelope>(APIS.twoFactorAuth.verify2fa, data);
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}
