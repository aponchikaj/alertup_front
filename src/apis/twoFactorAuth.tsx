import axios from "axios"
import { APIS } from "./APIS"

export const enable2fa = async()=>{
    try{
        const res = (await axios.post(APIS.twoFactorAuth.activate2fa,undefined,{withCredentials:true})).data;
        if(!res) return {Success:false,Message:"Something went wrong."}

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

export const deactivate2fa = async()=>{
    try{
        const res = (await axios.post(APIS.twoFactorAuth.deactivate2fa,undefined,{withCredentials:true})).data;
        if(!res) return {Success:false,Message:"Something went wrong."}

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const verify2fa = async(data:any)=>{
    console.log(data)
    try{
        const res = (await axios.post(APIS.twoFactorAuth.verify2fa,data,{withCredentials:true})).data;
        if(!res) return {Success:false,Message:"Something went wrong."}

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}