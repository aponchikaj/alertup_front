import { APIS } from "./APIS";
import { get, post, put, del, errorMessage, type ApiResponse } from "./http";

export const createNewBuilding = async (data: FormData | Record<string, unknown>) => {
  try {
    const res = await post<ApiResponse>(APIS.buildings.newBuilding, data);
    return res || { Success: false, Message: 'Something went wrong.' };
  } catch (err) {
    console.error("createNewBuilding error:", err);
    return { Success: false, Message: errorMessage(err) };
  }
};

export const getMyBuildings = async () => {
  try {
    const res = await get<ApiResponse>(APIS.buildings.myBuildings);
    return res || { Success: false, Message: 'Something went wrong.' };
  } catch (err) {
    console.error("getMyBuildings error:", err);
    return { Success: false, Message: errorMessage(err) };
  }
};

export const deleteBuilding = async (buildingID: string) => {
  try {
    const res = await del<ApiResponse>(APIS.buildings.deleteBuilding + buildingID);
    return res || { Success: false, Message: 'Something went wrong.' };
  } catch (err) {
    console.error("deleteBuilding error:", err);
    return { Success: false, Message: errorMessage(err) };
  }
};

export const deactivateBuilding = async (id: string) => {
  try {
    const res = await put<ApiResponse>(`${APIS.buildings.deactivateBuilding}${id}`, {});
    return res || { Success: false, Message: 'Something went wrong.' };
  } catch (err) {
    console.error("deactivateBuilding error:", err);
    return { Success: false, Message: errorMessage(err) };
  }
};

export const getBuilding = async (data: { buildingID: string }) => {
  try {
    const res = await get<ApiResponse>(APIS.buildings.getBuilding + data.buildingID);
    if (!res) return { Success: false, Message: "Something went wrong." };
    return res;
  } catch (err) {
    return { Success: false, Message: errorMessage(err) };
  }
}

export const getFloor = async (data: { id: string; floor: string | number }) => {
  try {
    const res = await get<ApiResponse>(`${APIS.buildings.getFloor}${data.id}/${data.floor}`);
    if (!res) return { Success: false, Message: "Something went wrong." };
    return res;
  } catch (err) {
    return { Success: false, Message: errorMessage(err) };
  }
}

export const evacuatedFunc = async (buildingId: string | undefined) => {
  try {
    const res = await post<ApiResponse>(APIS.buildings.evacuated, { buildingId });
    if (!res) return { Success: false, Message: "Something went wrong." };
    return res;
  } catch (err) {
    return { Success: false, Message: errorMessage(err) };
  }
}
