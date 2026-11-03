import { APIS } from "./APIS"
import { get, post, errorMessage, failure, type Envelope } from "./http"
import type {
    EmergencyRecord,
    EmergencyReport,
    EmergencyResolveResult,
    EmergencyTriggerResult,
    LogEntry,
} from "../types/api"

/*
 * Logs and emergencies still travel in their Mongo-era document shape, keyed
 * by `_id`. They are renamed to `id` here, once, so no screen has to know.
 */
type Wire<T> = Omit<T, 'id'> & { _id: string }

const fromWire = <T extends { id: string }>({ _id, ...rest }: Wire<T>): T =>
    ({ ...rest, id: _id }) as unknown as T

/** Re-key the payload of a successful envelope; failures pass through. */
const mapData = <W, T>(res: Envelope<W>, map: (wire: W) => T): Envelope<T> =>
    res.data === undefined
        ? { success: res.success, message: res.message }
        : { success: res.success, message: res.message, data: map(res.data) }

export const GETBUILDINGLOGS = async (buildingId: string): Promise<Envelope<LogEntry[]>> => {
    try {
        const res = await get<Envelope<Wire<LogEntry>[]>>(`${APIS.administration.getBuildingLogs}/${buildingId}`);
        if (!res) return failure("Something went wrong.");
        return mapData(res, (logs) => logs.map(fromWire<LogEntry>));
    } catch (err) {
        return failure(errorMessage(err));
    }
}

export const CLEARBUILDINGLOGS = async (buildingId: string): Promise<Envelope> => {
    try {
        const res = await post<Envelope>(`${APIS.administration.clearBuildingLogs}/${buildingId}`, {});
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}

/**
 * Turn a building's emergency on or off — explicitly.
 *
 * FX-018: the old client hit a TOGGLE, so a page showing a stale "off" could
 * resolve a live emergency with an "activate" tap. `activate` calls the v2
 * trigger route (idempotent: already-active stays active) and `resolve` the
 * v2 resolve route, so the request always means what the button said.
 */
export const setEmergencyMode = async (
    buildingId: string,
    intent: 'activate' | 'resolve',
    challenge: { token: string; answer: number },
): Promise<Envelope<EmergencyTriggerResult | EmergencyResolveResult>> => {
    const url = intent === 'activate'
        ? APIS.administration.emergencyTrigger(buildingId)
        : APIS.administration.emergencyResolve(buildingId);
    try {
        const res = await post<Envelope<EmergencyTriggerResult | EmergencyResolveResult>>(url, { challenge });
        if (!res) return failure("Something went wrong.");
        return res;
    } catch (err) {
        return failure(errorMessage(err));
    }
}

export const GET_BUILDING_ANALYTICS = async (
    buildingID: string,
    filters?: Record<string, string | number | undefined | null>,
): Promise<Envelope<EmergencyRecord[]>> => {
    try {
        const res = await get<Envelope<Wire<EmergencyRecord>[]>>(APIS.administration.getBuildingAnalytics + buildingID, { params: filters });
        if (!res) return failure("Something went wrong.");
        return mapData(res, (list) => list.map(fromWire<EmergencyRecord>));
    } catch (err) {
        return failure(errorMessage(err));
    }
}

interface EmergencyReportWire {
    logs: Wire<LogEntry>[];
    emergency: Wire<EmergencyRecord>;
}

export const GET_EMERGENCY_DATA = async (data: { buildingID: string; emergencyID: string }): Promise<Envelope<EmergencyReport>> => {
    try {
        const res = await get<Envelope<EmergencyReportWire>>(`${APIS.administration.getEmergencyAnalytics}${data.buildingID}/${data.emergencyID}`);
        if (!res) return failure("Something went wrong.");
        return mapData(res, (report) => ({
            logs: report.logs.map(fromWire<LogEntry>),
            emergency: fromWire<EmergencyRecord>(report.emergency),
        }));
    } catch (err) {
        return failure(errorMessage(err));
    }
}
