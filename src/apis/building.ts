import { APIS } from "./APIS";
import { get, post, put, del, errorMessage, failure, type Envelope } from "./http";
import type { Building, BuildingOwner, FloorView, MemberBuilding } from "../types/api";

/** POST /api/building/new — the new id rides at the top level, beside the envelope. */
export type CreateBuildingResponse = Envelope & { buildingID?: string };

/** GET /api/building/my — owned buildings in `data`, shared ones beside it. */
export type MyBuildingsResponse = Envelope<Building[]> & { memberBuildings?: MemberBuilding[] };

/** DELETE /api/building/delete/:id */
export type DeleteBuildingResponse = Envelope & { DeletedCounts?: { nodes: number; floors: number } };

/** GET /api/building/id/:id — the public owner summary sits beside the building. */
export type BuildingResponse = Envelope<Building> & { Owner?: BuildingOwner };

export const createNewBuilding = async (data: FormData | Record<string, unknown>): Promise<CreateBuildingResponse> => {
  try {
    const res = await post<CreateBuildingResponse>(APIS.buildings.newBuilding, data);
    return res || failure('Something went wrong.');
  } catch (err) {
    return failure(errorMessage(err));
  }
};

export const getMyBuildings = async (): Promise<MyBuildingsResponse> => {
  try {
    const res = await get<MyBuildingsResponse>(APIS.buildings.myBuildings);
    return res || failure('Something went wrong.');
  } catch (err) {
    return failure(errorMessage(err));
  }
};

export const deleteBuilding = async (buildingID: string): Promise<DeleteBuildingResponse> => {
  try {
    const res = await del<DeleteBuildingResponse>(APIS.buildings.deleteBuilding + buildingID);
    return res || failure('Something went wrong.');
  } catch (err) {
    return failure(errorMessage(err));
  }
};

export const deactivateBuilding = async (id: string): Promise<Envelope> => {
  try {
    const res = await put<Envelope>(`${APIS.buildings.deactivateBuilding}${id}`, {});
    return res || failure('Something went wrong.');
  } catch (err) {
    return failure(errorMessage(err));
  }
};

export const getBuilding = async (data: { buildingID: string }): Promise<BuildingResponse> => {
  try {
    const res = await get<BuildingResponse>(APIS.buildings.getBuilding + data.buildingID);
    if (!res) return failure("Something went wrong.");
    return res;
  } catch (err) {
    return failure(errorMessage(err));
  }
}

export const getFloor = async (data: { id: string; floor: string | number }): Promise<Envelope<FloorView>> => {
  try {
    const res = await get<Envelope<FloorView>>(`${APIS.buildings.getFloor}${data.id}/${data.floor}`);
    if (!res) return failure("Something went wrong.");
    return res;
  } catch (err) {
    return failure(errorMessage(err));
  }
}

export const evacuatedFunc = async (buildingId: string | undefined): Promise<Envelope> => {
  try {
    const res = await post<Envelope>(APIS.buildings.evacuated, { buildingId });
    if (!res) return failure("Something went wrong.");
    return res;
  } catch (err) {
    return failure(errorMessage(err));
  }
}
