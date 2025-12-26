import axios from "axios"
import { APIS } from "./APIS"

export const SendResetCode = async(data:any)=>{
    try{
        const res=(await axios.post(APIS.reset.resetSendCode,data,{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:"Something went wrong."}
        }

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

export const ResetVerifyCode = async(data:any)=>{
    try{
        const res=(await axios.post(APIS.reset.resetVerifyCode,data,{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:"Something went wrong."}
        }

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

export const ResetNewPassword = async(data:any)=>{
    try{
        const res=(await axios.post(APIS.reset.resetPassword,data,{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:"Something went wrong."}
        }

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}