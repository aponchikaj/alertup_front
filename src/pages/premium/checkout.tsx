import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  capturePremiumOrder,
  CheckoutPaymentPremium
} from "../../apis/premium";
import { getMe } from "../../apis/me";

declare global {
  interface Window {
    paypal: any;
  }
}

const VALID_PLANS = ["Basic", "Platinum", "Elite", "Professional"];

const Checkout = () => {
  const { plan } = useParams<{ plan: string }>();
  const navigate = useNavigate();
  const paypalRef = useRef<HTMLDivElement>(null);

  const [orderID, setOrderID] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  
  useEffect(()=>{
    const checkUser= async()=>{
      try{
        const res= await getMe()
        if(!res){
          navigate('/login')
          return;
        }

        if(res.Success==false){
          navigate('/login');
          return;
        }

        return;
      }catch{
        navigate("/login")
      }
    }
    checkUser()
  },[])

  /* ---------------------------------- */
  /* Create PayPal order */
  /* ---------------------------------- */
  useEffect(() => {
    document.title="Premium - Alertup"
    if (!plan || !VALID_PLANS.includes(plan)) {
      setError("Invalid premium plan.");
      setLoading(false);
      return;
    }

    const createOrder = async () => {
      try {
        const res = await CheckoutPaymentPremium({ option: plan });
        if (!res.Success) {
          setError(res.Message);
          return;
        }
        setOrderID(res.Message.orderID);
      } catch {
        setError("Checkout failed.");
      } finally {
        setLoading(false);
      }
    };

    createOrder();
  }, [plan]);

  /* ---------------------------------- */
  /* Load PayPal SDK dynamically */
  /* ---------------------------------- */
  const loadPayPalSDK = () => {
    return new Promise<void>((resolve, reject) => {
      if (window.paypal) return resolve();
      const script = document.createElement("script");
      script.src =
        "https://www.paypal.com/sdk/js?client-id=YOUR_SANDBOX_CLIENT_ID&currency=USD&intent=capture";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("PayPal SDK failed to load"));
      document.body.appendChild(script);
    });
  };

  /* ---------------------------------- */
  /* Render PayPal + Apple Pay buttons */
  /* ---------------------------------- */
  useEffect(() => {
    if (!orderID) return;

    loadPayPalSDK()
      .then(() => {
        if (!paypalRef.current || !window.paypal) return;

        // Clear container to avoid double render
        paypalRef.current.innerHTML = "";

        window.paypal.Buttons({
          style: {
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: "paypal",
          },

          // Automatically shows Apple Pay if available
          createOrder: () => orderID,

          onApprove: async (data: any) => {
            try {
              const res = await capturePremiumOrder({
                orderID: data.orderID,
                option: plan,
              });

              if (!res.Success) {
                setError(res.Message);
                return;
              }

              navigate("/premium/success");
            } catch {
              setError("Payment capture failed.");
            }
          },

          onError: () => {
            setError("PayPal/Apple Pay error occurred.");
          },
        }).render(paypalRef.current);
      })
      .catch(() => setError("PayPal SDK failed to load."));
  }, [orderID]);

  /* ---------------------------------- */
  /* UI */
  /* ---------------------------------- */
  if (loading) {
    return (
      <main className="min-h-screen bg-[#353535] text-white flex items-center justify-center">
        Processing checkout...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#353535] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => navigate("/premium")}
          className="text-[#FF7B22]"
        >
          Back to plans
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#353535] text-white flex items-center justify-center">
      <div className="bg-[#2c2c2c] p-10 rounded-2xl w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Complete Your Purchase</h1>
        <p className="text-gray-400 mb-6">
          Plan: <span className="text-[#FF7B22]">{plan}</span>
        </p>
        <div ref={paypalRef} />
      </div>
    </main>
  );
};

export default Checkout;
