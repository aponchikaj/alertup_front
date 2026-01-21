/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios"
import { APIS } from "./APIS"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GETBUILDINGLOGS = async(data:any)=>{
    try{
        const res = (await axios.get(APIS.administration.getBuildingLogs+'/'+data,{withCredentials:true})).data;
        if(!res) return {Success:false,Message:"Something went wrong."};
        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CLEARBUILDINGLOGS = async(data:any)=>{
    try{
        const res = (await axios.post(APIS.administration.clearBuildingLogs+'/'+data,{},{withCredentials:true})).data;
        if(!res) return {Success:false,Message:"Something went wrong."};
        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EMERGENCY_MODE_FUNCTION = async(data:any)=>{
    try{
        const res = (await axios.post(APIS.administration.emergencyMode,{buildingID:data},{withCredentials:true})).data;
        if(!res) return {Success:false,Message:"Something went wrong."};
        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

export const GET_BUILDING_ANALYTICS=async(data:any,filters:any)=>{
    try{
        const res = (await axios.get(APIS.administration.getBuildingAnalytics+data,{params:filters,withCredentials:true})).data
        if(!res) return {Success:false,Message:"Something went wrong."}
        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}

export const GET_EMERGENCY_DATA = async(data:any)=>{
    // console.log(APIS.administration.getEmergencyAnalytics+data.buildingID+'/'+data.emergencyID)
    try{
        const res= (await axios.get(APIS.administration.getEmergencyAnalytics+data.buildingID+'/'+data.emergencyID,{withCredentials:true})).data
        // console.log(res)
        if(!res) return {Success:false,Message:"Something went wrong."}
        return res;
    }catch{
        return {Success:false,Message:"Something went wrong."}
    }
}