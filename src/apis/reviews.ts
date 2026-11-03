import { APIS } from "./APIS"
import { get, post, errorMessage, failure, type Envelope } from "./http"

export const checkUserReviewAvailability = async (): Promise<Envelope> => {
    try {
        const res = await get<Envelope>(APIS.reviews.checkReviewSent);
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}

export const sendFeedbackReview = async (data: unknown): Promise<Envelope> => {
    try {
        const res = await post<Envelope>(APIS.reviews.sendReview, data);
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}
