import { APIS } from "./APIS"
import { post, errorMessage, type ApiResponse } from "./http"

export const ContactAPI = async (data: unknown) => {
    try {
        const res = await post<ApiResponse>(APIS.contact, data);
        if (!res) return { Success: false, Message: 'Something went wrong.' };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}
