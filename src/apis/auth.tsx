import axios from "axios"
import { APIS } from "./APIS"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const RegisterUser = async(data:any)=>{
    console.log(data)
    try{
        const res = (await axios.post(APIS.auth.register,data,{withCredentials:true})).data;
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        // Safari/iOS fallback: Store token in localStorage if provided
        if(res.token){
            localStorage.setItem('userToken', res.token);
        }

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LoginUser = async(data:any)=>{
    try{
        const res = (await axios.post(APIS.auth.login,data,{withCredentials:true})).data;
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        // Safari/iOS fallback: Store token in localStorage if provided
        if(res.token){
            localStorage.setItem('userToken', res.token);
        }

        return res;
    }catch{
        return {Success:false,Message:'Something went wrong'}
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Login2faUser = async(data:any)=>{
    try{
        const res = (await axios.post(APIS.auth.twoFaAuth,data,{withCredentials:true})).data;
        if(!res) return {Success:false,Message:"Something went wrong."}

        if(res.token) localStorage.setItem('userToken',res.token);

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}