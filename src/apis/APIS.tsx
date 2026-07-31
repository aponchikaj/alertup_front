import { API_URL } from "./http";

// Endpoint paths. The origin comes from VITE_API_URL (see http.ts), so the
// backend URL is configured in one place instead of being hardcoded here and
// separately re-derived in half a dozen other modules.
//
// Local dev:  VITE_API_URL=http://localhost:3001
// Production: VITE_API_URL=https://alertup-backend.onrender.com
export const MAIN_API_URL: string = `${API_URL}/`;

export const APIS = {
    contact:`${MAIN_API_URL}contact`,
    me:`${MAIN_API_URL}me`,
    auth:{
        register:`${MAIN_API_URL}auth/register`,
        login:`${MAIN_API_URL}auth/login`,
        twoFaAuth:`${MAIN_API_URL}auth/login/2fa`
    },
    reset:{
        resetSendCode:`${MAIN_API_URL}reset/send-code`,
        resetVerifyCode:`${MAIN_API_URL}reset/verify-code`,
        resetPassword:`${MAIN_API_URL}reset/password`
    },
    twoFactorAuth:{
        activate2fa:`${MAIN_API_URL}2fa/activate`,
        deactivate2fa:`${MAIN_API_URL}2fa/deactivate`,
        verify2fa:`${MAIN_API_URL}2fa/verify`
    },
    getDashboard:`${MAIN_API_URL}dashboard`,
    buildings:{
        newBuilding:`${MAIN_API_URL}building/new`,
        myBuildings:`${MAIN_API_URL}building/my`,
        deactivateBuilding:`${MAIN_API_URL}building/deactivate/`,
        deleteBuilding:`${MAIN_API_URL}building/delete/`,
        getBuilding:`${MAIN_API_URL}building/id/`,
        getFloor:`${MAIN_API_URL}building/scan/`,
        evacuated:`${MAIN_API_URL}building/evacuated`
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
    connectAPI:`${MAIN_API_URL}connect`,
    reviews:{
        checkReviewSent:`${MAIN_API_URL}review/already`,
        sendReview:`${MAIN_API_URL}review/alertup`
    },
    administration:{
        getBuildingLogs:`${MAIN_API_URL}administration/logs`,
        clearBuildingLogs:`${MAIN_API_URL}administration/logs/clear`,
        emergencyMode:`${MAIN_API_URL}administration/emergency`,
        getBuildingAnalytics:`${MAIN_API_URL}administration/analytics/`,
        getEmergencyAnalytics:`${MAIN_API_URL}administration/analytics/`
    }
}
