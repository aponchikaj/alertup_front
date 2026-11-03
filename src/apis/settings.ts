import { APIS } from "./APIS"
import { get, post, put, errorMessage, failure, type Envelope } from "./http"
import type { UserSettings } from "../types/api"

export const saveSettings = async (data: unknown): Promise<Envelope> => {
  try {
    const res = await put<Envelope>(APIS.settings.saveSettings, data);
    if (!res) return failure('Something went wrong.');
    return res;
  } catch (err) {
    return failure(errorMessage(err));
  }
}

export const changeUserPassword = async (data: unknown): Promise<Envelope> => {
  try {
    const res = await put<Envelope>(APIS.settings.changePassword, data);
    if (!res) return failure('Something went wrong.');
    return res;
  } catch (err) {
    return failure(errorMessage(err));
  }
}

export const sendNewEmailVerification = async (data: unknown): Promise<Envelope> => {
  try {
    const res = await post<Envelope>(APIS.settings.email.POSTchangeEmailSendVerification, data);
    if (!res) return failure('Something went wrong.');
    return res;
  } catch (err) {
    return failure(errorMessage(err));
  }
}

export const verifyNewEmailCode = async (data: unknown): Promise<Envelope> => {
  try {
    const res = await put<Envelope>(APIS.settings.email.PUTchangeEmailVerifyCode, data);
    if (!res) return failure('Something went wrong.');
    return res;
  } catch (err) {
    return failure(errorMessage(err));
  }
}

export const sendVerificationCode = async (): Promise<Envelope> => {
  try {
    const res = await post<Envelope>(APIS.settings.verifyAccount.POSTSendAccountVerification, {});
    if (!res) return failure('Something went wrong.');
    return res;
  } catch (err) {
    return failure(errorMessage(err));
  }
}

export const verifyAccountCode = async (data: unknown): Promise<Envelope> => {
  try {
    const res = await put<Envelope>(APIS.settings.verifyAccount.PUTVerifyAccountCode, data);
    if (!res) return failure('Something went wrong.');
    return res;
  } catch (err) {
    return failure(errorMessage(err));
  }
}

export const deleteAccount = async (data: unknown): Promise<Envelope> => {
  try {
    const res = await post<Envelope>(APIS.settings.deleteAccount, data);
    if (!res) return failure('Something went wrong.');

    // Clear the Safari/iOS fallback token
    localStorage.removeItem('userToken');

    return res;
  } catch (err) {
    return failure(errorMessage(err));
  }
}

export const logoutFromAccount = async (): Promise<Envelope> => {
  try {
    const res = await post<Envelope>(APIS.settings.logoutAccount, {});

    // Clear the token regardless of what the server said — the user asked to
    // log out, so the client-side session must not survive.
    localStorage.removeItem('userToken');

    if (!res) return failure('Something went wrong.');
    return res;
  } catch (err) {
    localStorage.removeItem('userToken');
    return failure(errorMessage(err));
  }
}

export const getSettings = async (): Promise<Envelope<UserSettings>> => {
  try {
    const res = await get<Envelope<UserSettings>>(APIS.settings.getSettings);
    if (!res) return failure("Something went wrong.");
    return res;
  } catch (err) {
    return failure(errorMessage(err));
  }
}
