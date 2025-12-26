import axios from "axios"
import { APIS } from "./APIS"

export const ConnectApis = async()=>{
    try{
        const res = (await axios.get(APIS.connectAPI,{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch(error){
        return {Success:false,Message:'Something went wrong'}
    }
}