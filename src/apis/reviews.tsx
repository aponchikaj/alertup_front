import axios from "axios"
import { APIS } from "./APIS"

export const checkUserReviewAvailability = async()=>{
    try{
        const res = (await axios.get(APIS.reviews.checkReviewSent,{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:"Something went wrong."}
        }

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

export const sendFeedbackReview = async(data:any)=>{
    try{
        const res = (await axios.post(APIS.reviews.sendReview,data,{withCredentials:true})).data
        console.log(res)
        if(!res){
            return {Success:false,Message:"Something went wrong."}
        }

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}