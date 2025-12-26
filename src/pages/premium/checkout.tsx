import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { capturePremiumOrder, CheckoutPaymentPremium } from "../../apis/premium";
import { getMe } from "../../apis/me";

declare global { interface Window { paypal: any; } }

const VALID_PLANS = ["Basic","Platinum","Elite","Professional"];

const Checkout = () => {
  const { plan } = useParams<{ plan: string }>();
  const navigate = useNavigate();
  const paypalRef = useRef<HTMLDivElement>(null);

  const [orderID, setOrderID] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // -------------------- Check auth --------------------
  useEffect(()=>{
    (async()=>{
      try {
        const res = await getMe();
        if(!res || !res.Success) navigate("/login");
      }catch{ navigate("/login"); }
    })();
  },[]);

  // -------------------- Create order --------------------
  useEffect(()=>{
    document.title = "Premium - AlertUp";
    if(!plan || !VALID_PLANS.includes(plan)){ setError("Invalid premium plan"); setLoading(false); return; }

    (async()=>{
      try {
        const res = await CheckoutPaymentPremium({ option: plan });
        if(!res.Success){ setError(res.Message); return; }
        setOrderID(res.Message.orderID);
      }catch{ setError("Checkout failed"); } finally{ setLoading(false); }
    })();
  },[plan]);

  // -------------------- Load SDK --------------------
  const loadPayPalSDK = (clientId: string) =>
    new Promise<void>((resolve,reject)=>{
      if(window.paypal) return resolve();
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&components=buttons`;
      script.async = true;
      script.onload = ()=>resolve();
      script.onerror = ()=>reject(new Error("PayPal SDK failed to load"));
      document.body.appendChild(script);
    });

  // -------------------- Render buttons --------------------
  useEffect(()=>{
    if(!orderID) return;

    (async()=>{
      try {
        const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID!;
        await loadPayPalSDK(clientId);
        if(!paypalRef.current || !window.paypal) return;

        paypalRef.current.innerHTML = ""; // clear previous

        const button = window.paypal.Buttons({
          fundingSource: window.paypal.FUNDING.PAYPAL, // PayPal
          style: { layout: "vertical", color:"gold", shape:"rect", label:"paypal" },
          createOrder: ()=> orderID,
          onApprove: async (data:any)=>{
            try{
              const res = await capturePremiumOrder({ orderID: data.orderID, option: plan });
              if(!res.Success){ setError(res.Message); return; }
              navigate("/premium/success");
            }catch{ setError("Payment capture failed"); }
          },
          onError: (err:any)=>{ console.error(err); setError("Payment error occurred"); }
        });

        if(button.isEligible()) button.render(paypalRef.current);

        const cardButton = window.paypal.Buttons({
          fundingSource: window.paypal.FUNDING.CARD, // Card only
          style: { layout:"vertical", color:"black", shape:"rect", label:"paypal" },
          createOrder: ()=> orderID,
          onApprove: async (data:any)=>{
            try{
              const res = await capturePremiumOrder({ orderID: data.orderID, option: plan });
              if(!res.Success){ setError(res.Message); return; }
              navigate("/premium/success");
            }catch{ setError("Payment capture failed"); }
          },
          onError: (err:any)=>{ console.error(err); setError("Card payment error"); }
        });

        if(cardButton.isEligible()) cardButton.render(paypalRef.current);

      }catch(err){ console.error(err); setError("PayPal SDK failed to load"); }
    })();
  },[orderID]);

  // -------------------- UI --------------------
  if(loading) return <main className="min-h-screen bg-[#353535] text-white flex items-center justify-center">Processing checkout...</main>;
  if(error) return <main className="min-h-screen bg-[#353535] text-white flex flex-col items-center justify-center gap-4">
    <p className="text-red-400">{error}</p>
    <button onClick={()=>navigate("/premium")} className="text-[#FF7B22]">Back to plans</button>
  </main>;

  return (
    <main className="min-h-screen bg-[#353535] text-white flex items-center justify-center">
      <div className="bg-[#2c2c2c] p-10 rounded-2xl w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Complete Your Purchase</h1>
        <p className="text-gray-400 mb-6">Plan: <span className="text-[#FF7B22]">{plan}</span></p>
        <div ref={paypalRef}/>
      </div>
    </main>
  );
};

export default Checkout;
