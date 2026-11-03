import { APIS } from "./APIS"
import { post, errorMessage, failure, type Envelope } from "./http"

export const ContactAPI = async (data: unknown): Promise<Envelope> => {
    try {
        const res = await post<Envelope>(APIS.contact, data);
        if (!res) return failure('Something went wrong.');
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}
