import axios from "axios"
import { APIS } from "./APIS"

export const Get_Premium_Plans = async()=>{
    try{
        const res = (await axios.get(APIS.premium.getPremiumPlans)).data;
        if(!res){
            return {Success:false,Message:"Something went wrong."}
        }

        return res;
    }catch{
        return {Success:false,Message:'Something went wrong.'}
    }
}

export const CheckoutPaymentPremium = async(data:any)=>{
    try{
        const res = (await axios.post(APIS.premium.checkoutPremium,data,{withCredentials:true})).data;
        if(!res){
            return {Success:false,Message:"Something went wrong."}
        }

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

export const capturePremiumOrder = async(data:any)=>{
    try{
        const res = (await axios.post(APIS.premium.captureOrder,data)).data;
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}