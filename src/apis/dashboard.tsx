import axios from "axios"
import { APIS } from "./APIS"

export const getDashboard = async()=>{
    try{
        const res = (await axios.get(APIS.getDashboard,{withCredentials:true})).data

        if(!res){
            return {Success:false,Message:"Something went wrong."}
        }

        return res;
    }catch{ 
        return {Success:false,Message:"Something went wrong"}
    }
}