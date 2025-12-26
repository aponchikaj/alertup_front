import { APIS } from "./APIS";
import axios from "axios";

export const getMe = async() => {
    try{
        const res = (await axios.get(APIS.me,{withCredentials:true})).data
        if(!res){
            return {Success:false,Message:"Something went wrong."}
        }

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}