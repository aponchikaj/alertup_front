import { APIS } from "./APIS"
import { get, post, errorMessage, type ApiResponse } from "./http"

export const checkUserReviewAvailability = async () => {
    try {
        const res = await get<ApiResponse>(APIS.reviews.checkReviewSent);
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}

export const sendFeedbackReview = async (data: unknown) => {
    try {
        const res = await post<ApiResponse>(APIS.reviews.sendReview, data);
        if (!res) return { Success: false, Message: "Something went wrong." };
        return res;
    } catch (err) {
        return { Success: false, Message: errorMessage(err) };
    }
}
