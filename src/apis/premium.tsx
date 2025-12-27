import axios from "axios";
import { APIS } from "./APIS";

export const Get_Premium_Plans = async () => {
  const res = await axios.get(APIS.premium.getPremiumPlans, { withCredentials: true });
  return res.data;
};

export const CreateSubscription = async (data: { option: string }) => {
  const res = await axios.post(APIS.premium.subscribePremium, data, { withCredentials: true });
  return res.data;
};

export const CancelSubscription = async () => {
  const res = await axios.post(APIS.premium.cancelPremium, {}, { withCredentials: true });
  return res.data;
};
