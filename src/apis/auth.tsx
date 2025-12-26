import axios from "axios"
import { APIS } from "./APIS"

export const RegisterUser = async(data:any)=>{
    try{
        const res = (await axios.post(APIS.auth.register,data,{withCredentials:true})).data;
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

export const LoginUser = async(data:any)=>{
    try{
        const res = (await axios.post(APIS.auth.login,data,{withCredentials:true})).data;
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch{
        return {Success:false,Message:'Something went wrong'}
    }
}