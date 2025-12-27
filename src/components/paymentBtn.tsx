import { useEffect, useRef } from "react";
import { CreateOrder } from "../apis/premium";

declare global {
  interface Window { paypal: any; }
}

interface Props {
  plan: string; // Plan name: Basic, Platinum, Elite, Professional
  price: number;
}

const PaymentButton = ({ plan, price }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plan || !containerRef.current) return;

    // Clear previous buttons (important)
    containerRef.current.innerHTML = "";

    const loadPaypalScript = () => {
      return new Promise<void>((resolve) => {
        if (window.paypal) return resolve(); // already loaded

        // Use environment variable or default to sandbox for testing
        // Set VITE_PAYPAL_CLIENT_ID in your .env file for production
        const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || 
                        'AQ_vHdiFQWqEH2jJ3r-BZxSyjnqwOF_tAZai0KGvae6cQLZuQ1N6E6KVH9xt9fQMdtKNHOeSM2dzHaWQ';
        const useSandbox = import.meta.env.VITE_PAYPAL_SANDBOX !== 'false'; // Default to sandbox unless explicitly disabled
        
        const script = document.createElement("script");
        // Use sandbox URL if sandbox mode is enabled
        const sdkUrl = useSandbox 
          ? `https://www.sandbox.paypal.com/sdk/js?client-id=${clientId}&currency=USD`
          : `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
        script.src = sdkUrl;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
          console.error("Failed to load PayPal SDK");
          resolve(); // Resolve anyway to prevent hanging
        };
        document.body.appendChild(script);
      });
    };

    loadPaypalScript().then(() => {
      if (!window.paypal || !containerRef.current) return;

      // Validate plan before creating button
      if (!plan || plan.trim() === "") {
        console.error("Invalid plan");
        containerRef.current.innerHTML = "<p style='color: red;'>Invalid plan. Please contact support.</p>";
        return;
      }

      window.paypal.Buttons({
        style: { shape: "pill", color: "gold", layout: "vertical", label: "pay" },
        createOrder: async (_data: any, actions: any) => {
          try {
            console.log("Creating order for plan:", plan);
            // Create order on backend
            const response = await CreateOrder(plan);
            console.log("Backend response:", response);
            
            if (!response.Success) {
              const errorMsg = response.Message || "Failed to create order";
              console.error("Backend error:", errorMsg, response);
              throw new Error(errorMsg);
            }
            
            if (!response.Message?.orderID) {
              console.error("No orderID in response:", response);
              throw new Error("No order ID received from server");
            }
            
            console.log("Order created successfully:", response.Message.orderID);
            return response.Message.orderID;
          } catch (err: any) {
            console.error("Error creating order - Full error:", err);
            console.error("Error response:", err.response);
            console.error("Error message:", err.message);
            
            // Extract more detailed error message
            let errorMessage = "Payment failed";
            if (err.response?.data?.Message) {
              errorMessage = err.response.data.Message;
            } else if (err.message) {
              errorMessage = err.message;
            } else if (err.response?.data?.error) {
              errorMessage = JSON.stringify(err.response.data.error);
            }
            
            throw new Error(errorMessage);
          }
        },
        onApprove: async (data: any) => {
          try {
            // Capture payment and activate premium
            if (data.orderID) {
              window.location.href = `/premium/success?order_id=${data.orderID}&plan=${plan}`;
            } else {
              console.error("No order ID received");
              alert("Payment approved but no order ID received. Please contact support.");
            }
          } catch (err) {
            console.error("Error on approval:", err);
            alert("Payment processing error. Please contact support.");
          }
        },
        onError: (err: any) => {
          console.error("PayPal Button error:", err);
          
          // Provide user-friendly error messages
          let errorMessage = "Payment failed. Please try again.";
          
          if (err?.message) {
            if (err.message.includes("PAYEE_ACCOUNT_RESTRICTED")) {
              errorMessage = "PayPal account is restricted. Please contact support or try a different payment method.";
            } else if (err.message.includes("INSTRUMENT_DECLINED")) {
              errorMessage = "Payment method was declined. Please try a different payment method.";
            } else if (err.message.includes("INSUFFICIENT_FUNDS")) {
              errorMessage = "Insufficient funds. Please use a different payment method.";
            } else {
              errorMessage = `Payment error: ${err.message}`;
            }
          }
          
          alert(errorMessage);
        },
        onCancel: () => {
          console.log("User cancelled PayPal payment");
        },
      }).render(containerRef.current);
    });

    // Cleanup on unmount
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [plan, price]);

  return <div ref={containerRef}></div>;
};

export default PaymentButton;
