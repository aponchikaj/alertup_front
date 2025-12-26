import axios from "axios"
import { APIS } from "./APIS"

export const saveSettings = async (data: any) => {
  try {
    // Use PUT instead of POST
    const res = (await axios.put(APIS.settings.saveSettings, data, { withCredentials: true })).data;

    if (!res) return { Success: false, Message: 'Something went wrong.' };

    return res;
  } catch (err: any) {
    return { Success: false, Message: err.response?.data?.Message || 'Something went wrong.' };
  }
}

export const changeUserPassword = async(data:any)=>{
    try{
        const res = (await axios.put(APIS.settings.changePassword,data,{withCredentials:true})).data
        console.log(res)
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch{
        return {Success:false,Message:'Something went wrong.'}
    }
}

export const sendNewEmailVerification = async(data:any)=>{
    try{
        const res = (await axios.post(APIS.settings.email.POSTchangeEmailSendVerification,data,{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch{
        return {Success:false,Message:'Something went wrong.'}
    }
}

export const verifyNewEmailCode = async(data:any)=>{
    try{
        const res = (await axios.put(APIS.settings.email.PUTchangeEmailVerifyCode,data,{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch{
        return {Success:false,Message:'Something went wrong.'}
    }
}

export const sendVerificationCode = async()=>{
    try{
        const res = (await axios.post(APIS.settings.verifyAccount.POSTSendAccountVerification,{},{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch{
        return {Success:false,Message:'Something went wrong.'}
    }
}

export const verifyAccountCode = async(data:any)=>{
    try{
        const res = (await axios.put(APIS.settings.verifyAccount.PUTVerifyAccountCode,data,{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch{
        return {Success:false,Message:'Something went wrong.'}
    }
}

export const deleteAccount = async(data:any)=>{
    try{
        const res = (await axios.post(APIS.settings.deleteAccount,data,{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch{
        return {Success:false,Message:'Something went wrong.'}
    }
}

export const logoutFromAccount = async()=>{
    try{
        const res = (await axios.post(APIS.settings.logoutAccount,{},{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch{
        return {Success:false,Message:'Something went wrong.'}
    }
}

export const getSettings = async()=>{
    try{
        const res = await (await axios.get(APIS.settings.getSettings,{withCredentials:true})).data
        console.log(res)
        if(!res) return {Success:false,Message:"Something went wrong."}
        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}