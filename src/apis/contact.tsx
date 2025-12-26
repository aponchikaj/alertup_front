import axios from "axios"
import { APIS } from "./APIS"

export const ContactAPI = async(data:any)=>{
    try{
        // console.log(data)
        const res = (await axios.post(APIS.contact,data)).data;
        if(!res ){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}