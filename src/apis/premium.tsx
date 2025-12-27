import axios from "axios";
import { APIS } from "./APIS";

export const Get_Premium_Plans = async () => {
  const res = await axios.get(APIS.premium.getPremiumPlans, { withCredentials: true });
  return res.data;
};

export const CreateOrder = async (plan: string) => {
  try {
    console.log("API: Creating order for plan:", plan);
    console.log("API: Endpoint:", APIS.premium.purchasePremium);
    const res = await axios.post(
      APIS.premium.purchasePremium, 
      { option: plan }, 
      { 
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    console.log("API: Response received:", res.data);
    return res.data;
  } catch (error: any) {
    console.error("API: Error creating order:", error);
    console.error("API: Error response:", error.response?.data);
    console.error("API: Error status:", error.response?.status);
    
    // Return error in the same format as success
    return {
      Success: false,
      Message: error.response?.data?.Message || error.message || "Failed to create order",
      error: error.response?.data
    };
  }
};

export const ConfirmPurchase = async (orderID: string, plan: string) => {
  const res = await axios.post(APIS.premium.confirmPremium, { orderID, plan }, { withCredentials: true });
  return res.data;
};

export const ChargePayment = async (token: any, amount: number, plan: string, method = 'wallet') => {
  try {
    const res = await axios.post('/api/payments/charge', { token, amount, plan, method }, { withCredentials: true });
    return res.data;
  } catch (err: any) {
    console.error('ChargePayment error', err);
    return { Success: false, Message: err.response?.data?.Message || err.message };
  }
};
