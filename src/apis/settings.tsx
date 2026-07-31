import { APIS } from "./APIS"
import { get, post, put, errorMessage, type ApiResponse } from "./http"

export const saveSettings = async (data: unknown) => {
  try {
    const res = await put<ApiResponse>(APIS.settings.saveSettings, data);
    if (!res) return { Success: false, Message: 'Something went wrong.' };
    return res;
  } catch (err) {
    return { Success: false, Message: errorMessage(err) };
  }
}

export const changeUserPassword = async (data: unknown) => {
  try {
    const res = await put<ApiResponse>(APIS.settings.changePassword, data);
    if (!res) return { Success: false, Message: 'Something went wrong.' };
    return res;
  } catch (err) {
    return { Success: false, Message: errorMessage(err) };
  }
}

export const sendNewEmailVerification = async (data: unknown) => {
  try {
    const res = await post<ApiResponse>(APIS.settings.email.POSTchangeEmailSendVerification, data);
    if (!res) return { Success: false, Message: 'Something went wrong.' };
    return res;
  } catch (err) {
    return { Success: false, Message: errorMessage(err) };
  }
}

export const verifyNewEmailCode = async (data: unknown) => {
  try {
    const res = await put<ApiResponse>(APIS.settings.email.PUTchangeEmailVerifyCode, data);
    if (!res) return { Success: false, Message: 'Something went wrong.' };
    return res;
  } catch (err) {
    return { Success: false, Message: errorMessage(err) };
  }
}

export const sendVerificationCode = async () => {
  try {
    const res = await post<ApiResponse>(APIS.settings.verifyAccount.POSTSendAccountVerification, {});
    if (!res) return { Success: false, Message: 'Something went wrong.' };
    return res;
  } catch (err) {
    return { Success: false, Message: errorMessage(err) };
  }
}

export const verifyAccountCode = async (data: unknown) => {
  try {
    const res = await put<ApiResponse>(APIS.settings.verifyAccount.PUTVerifyAccountCode, data);
    if (!res) return { Success: false, Message: 'Something went wrong.' };
    return res;
  } catch (err) {
    return { Success: false, Message: errorMessage(err) };
  }
}

export const deleteAccount = async (data: unknown) => {
  try {
    const res = await post<ApiResponse>(APIS.settings.deleteAccount, data);
    if (!res) return { Success: false, Message: 'Something went wrong.' };

    // Clear the Safari/iOS fallback token
    localStorage.removeItem('userToken');

    return res;
  } catch (err) {
    return { Success: false, Message: errorMessage(err) };
  }
}

export const logoutFromAccount = async () => {
  try {
    const res = await post<ApiResponse>(APIS.settings.logoutAccount, {});

    // Clear the token regardless of what the server said — the user asked to
    // log out, so the client-side session must not survive.
    localStorage.removeItem('userToken');

    if (!res) return { Success: false, Message: 'Something went wrong.' };
    return res;
  } catch (err) {
    localStorage.removeItem('userToken');
    return { Success: false, Message: errorMessage(err) };
  }
}

export const getSettings = async () => {
  try {
    const res = await get<ApiResponse>(APIS.settings.getSettings);
    if (!res) return { Success: false, Message: "Something went wrong." };
    return res;
  } catch (err) {
    return { Success: false, Message: errorMessage(err) };
  }
}
