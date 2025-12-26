import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { capturePremiumOrder, CheckoutPaymentPremium } from "../../apis/premium";
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
  const [cardSupported, setCardSupported] = useState(true); // to detect unsupported card funding

  // Check user auth
  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await getMe();
        if (!res || res.Success === false) {
          navigate("/login");
        }
      } catch {
        navigate("/login");
      }
    };
    checkUser();
  }, []);

  // Create PayPal order
  useEffect(() => {
    document.title = "Premium - Alertup";
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

  // Load PayPal SDK dynamically
  const loadPayPalSDK = () => {
    return new Promise<void>((resolve, reject) => {
      if (window.paypal) return resolve();
      const script = document.createElement("script");
      const paypalClientId = (import.meta as any).env?.VITE_PAYPAL_CLIENT_ID || "sb";
      script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD&intent=capture`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("PayPal SDK failed to load"));
      document.body.appendChild(script);
    });
  };

  // Render PayPal button with fallback for unsupported cards
  useEffect(() => {
    if (!orderID) return;

    loadPayPalSDK()
      .then(() => {
        if (!paypalRef.current || !window.paypal) return;

        paypalRef.current.innerHTML = ""; // clear previous renders

        // Force PayPal funding only if card not supported
        const fundingSources = cardSupported
          ? [window.paypal.FUNDING.PAYPAL, window.paypal.FUNDING.CARD]
          : [window.paypal.FUNDING.PAYPAL];

        fundingSources.forEach((funding: any) => {
          const button = window.paypal.Buttons({
            fundingSource: funding,
            style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
            createOrder: () => orderID,
            onApprove: async (data: any) => {
              try {
                const res = await capturePremiumOrder({ orderID: data.orderID, option: plan });
                if (!res.Success) {
                  setError(res.Message);
                  return;
                }
                navigate("/premium/success");
              } catch {
                setError("Payment capture failed.");
              }
            },
            onError: (err: any) => {
              console.error("PayPal button error:", err);
              // Detect if error is due to unsupported card funding
              if (err?.error?.includes("INVALID_RESOURCE_ID") || err?.error?.includes("customer country")) {
                setCardSupported(false);
              } else {
                setError("PayPal/Apple Pay error occurred.");
              }
            },
          });

          if (button.isEligible()) button.render(paypalRef.current);
        });
      })
      .catch(() => setError("PayPal SDK failed to load."));
  }, [orderID, cardSupported]);

  // UI
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
        <button onClick={() => navigate("/premium")} className="text-[#FF7B22]">
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

        {!cardSupported && (
          <p className="text-yellow-400 mb-4 text-sm">
            Card payments may not be available in your country. Please use a PayPal account.
          </p>
        )}

        <div ref={paypalRef} />
      </div>
    </main>
  );
};

export default Checkout;
