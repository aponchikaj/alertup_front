import axios from "axios"
import { APIS } from "./APIS"

export const ConnectApis = async()=>{
    try{
        const res = (await axios.get(APIS.connectAPI,{
            withCredentials:true,
            timeout: 10000 // 10 second timeout
        })).data
        
        if(!res){
            return {Success:false,Message:'Something went wrong.'}
        }

        return res;
    }catch(error: any){
        console.error("ConnectApis error:", error);
        
        // Provide more specific error messages
        if (error.code === 'ECONNABORTED') {
            return {Success:false,Message:'Connection timeout. Server may be slow or unavailable.'}
        }
        
        if (error.response) {
            // Server responded with error status
            return {Success:false,Message:`Server error: ${error.response.status}`}
        }
        
        if (error.request) {
            // Request was made but no response received
            return {Success:false,Message:'No response from server. Check if backend is running.'}
        }
        
        // Network error or other issue
        return {Success:false,Message:`Connection failed: ${error.message || 'Unknown error'}`}
    }
}