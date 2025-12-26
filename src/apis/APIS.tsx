// Use Vite env `VITE_API_URL` when available (set in production), otherwise fallback to known backend.
const envApi = typeof import.meta !== 'undefined' ? (import.meta.env.VITE_API_URL as string | undefined) : undefined;
export const MAIN_API_URL: string = (envApi && envApi.endsWith('/') ? envApi : envApi ? envApi + '/' : 'https://alertup-backend.onrender.com/api/');
export const APIS = {
    contact:`${MAIN_API_URL}contact`,
    me:`${MAIN_API_URL}me`,
    auth:{
        register:`${MAIN_API_URL}auth/register`,
        login:`${MAIN_API_URL}auth/login`,
    },
    reset:{
        resetSendCode:`${MAIN_API_URL}reset/send-code`,
        resetVerifyCode:`${MAIN_API_URL}reset/verify-code`,
        resetPassword:`${MAIN_API_URL}reset/password`
    },
    premium:{
        getPremiumPlans:`${MAIN_API_URL}premium/plans`,
        checkoutPremium:`${MAIN_API_URL}premium/checkout`,
        captureOrder:`${MAIN_API_URL}premium/capture`
    },
    getDashboard:`${MAIN_API_URL}dashboard`,
    buildings:{
        newBuilding:`${MAIN_API_URL}building/new`,
        myBuildings:`${MAIN_API_URL}building/my`,
        deactivateBuilding:`${MAIN_API_URL}building/deactivate/`,
        deleteBuilding:`${MAIN_API_URL}building/`,
        getBuilding:`${MAIN_API_URL}building/id/`,
        getFloor:`${MAIN_API_URL}building/scan/`
    },
    settings:{
        getSettings:`${MAIN_API_URL}settings`,
        saveSettings:`${MAIN_API_URL}settings/save`,
        changePassword:`${MAIN_API_URL}settings/changePassword`,
        email:{
            POSTchangeEmailSendVerification:`${MAIN_API_URL}settings/email`,
            PUTchangeEmailVerifyCode:`${MAIN_API_URL}settings/email`,
        },
        verifyAccount:{
            POSTSendAccountVerification:`${MAIN_API_URL}settings/verify`,
            PUTVerifyAccountCode:`${MAIN_API_URL}settings/verify`
        },
        deleteAccount:`${MAIN_API_URL}settings/account`,
        logoutAccount:`${MAIN_API_URL}settings/logout`
    },
    connectAPI:`${MAIN_API_URL}connect`
}