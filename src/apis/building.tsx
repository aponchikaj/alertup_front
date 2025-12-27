import axios from "axios";
import { APIS } from "./APIS";

export const createNewBuilding = async (data: any) => {
  try {
    const res = (await axios.post(APIS.buildings.newBuilding, data, { withCredentials: true })).data;
    return res || { Success: false, Message: 'Something went wrong.' };
  } catch (err) {
    console.error("createNewBuilding error:", err);
    return { Success: false, Message: "Something went wrong." };
  }
};

export const getMyBuildings = async () => {
  try {
    const res = (await axios.get(APIS.buildings.myBuildings, { withCredentials: true })).data;
    console.log(res)
    return res || { Success: false, Message: 'Something went wrong.' };
  } catch (err) {
    console.error("getMyBuildings error:", err);
    return { Success: false, Message: "Something went wrong." };
  }
};


export const deleteBuilding = async (buildingID: string) => {
  console.log(buildingID)
  try {
    const res = (await axios.get(APIS.buildings.deleteBuilding+buildingID, {
      withCredentials: true,
    })).data;
    console.log(res)
    return res || { Success: false, Message: 'Something went wrong.' };
  } catch (err) {
    console.error("deleteBuilding error:", err);
    return { Success: false, Message: "Something went wrong." };
  }
};

export const deactivateBuilding = async (id: string) => {
  try {
    const res = (await axios.put(
      `${APIS.buildings.deactivateBuilding}${id}`,
      {}, // empty body
      { withCredentials: true } // config
    )).data;
    return res || { Success: false, Message: 'Something went wrong.' };
  } catch (err) {
    console.error("deactivateBuilding error:", err);
    return { Success: false, Message: "Something went wrong." };
  }
};

export const getBuilding = async(data:any)=>{
  // console.log(data.buildingID)
  try{
    const res= (await axios.get(APIS.buildings.getBuilding+data.buildingID,{withCredentials:true})).data
    if(!res){
      return {Success:false,Message:"Something went wrong."}
    }
    return res;
  }catch{
    return {Success:false,Message:"Something went wrong."}
  }
}

export const getFloor = async(data:any)=>{
  // console.log(data.buildingID)
  // console.log(data)
  try{
    const res= (await axios.get(APIS.buildings.getFloor+data.id+'/'+data.floor,{withCredentials:true})).data
    if(!res){
      return {Success:false,Message:"Something went wrong."}
    }
    return res;
  }catch{
    return {Success:false,Message:"Something went wrong."}
  }
}