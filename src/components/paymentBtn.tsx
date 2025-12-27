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

        // Use environment variable or default to the existing client ID
        // IMPORTANT: This client ID appears to be restricted. 
        // You need to either:
        // 1. Get PayPal Sandbox credentials from https://developer.paypal.com
        // 2. Fix your live PayPal account restrictions
        const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || 
                        'AQ_vHdiFQWqEH2jJ3r-BZxSyjnqwOF_tAZai0KGvae6cQLZuQ1N6E6KVH9xt9fQMdtKNHOeSM2dzHaWQ';
        
        // Check if we should use sandbox (default to false, set VITE_PAYPAL_SANDBOX=true to enable)
        const useSandbox = import.meta.env.VITE_PAYPAL_SANDBOX === 'true';
        
        const script = document.createElement("script");
        
        // Build the SDK URL - use live by default unless sandbox is explicitly enabled
        const sdkUrl = useSandbox
          ? `https://www.sandbox.paypal.com/sdk/js?client-id=${clientId}&currency=USD`
          : `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
        
        console.log("Loading PayPal SDK...", useSandbox ? "(SANDBOX)" : "(LIVE)");
        script.src = sdkUrl;
        script.async = true;
        script.onload = () => {
          console.log("PayPal SDK loaded successfully");
          resolve();
        };
        script.onerror = (error) => {
          console.error("Failed to load PayPal SDK:", error);
          console.error("This usually means:");
          console.error("1. PayPal Client ID is invalid or restricted");
          console.error("2. Account is restricted (PAYEE_ACCOUNT_RESTRICTED)");
          console.error("3. For testing, use PayPal Sandbox credentials");
          
          if (containerRef.current) {
            containerRef.current.innerHTML = `
              <div style="padding: 20px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; color: #856404; max-width: 500px; margin: 0 auto;">
                <h3 style="margin-top: 0; color: #856404;">⚠️ PayPal Payment Unavailable</h3>
                <p><strong>Your PayPal account is restricted.</strong></p>
                <p>To fix this:</p>
                <ol style="text-align: left; margin: 10px 0; padding-left: 20px;">
                  <li><strong>For Testing:</strong> Get PayPal Sandbox credentials from <a href="https://developer.paypal.com" target="_blank" style="color: #0056b3;">developer.paypal.com</a></li>
                  <li><strong>For Production:</strong> Fix your PayPal account restrictions at <a href="https://www.paypal.com/businessmanage" target="_blank" style="color: #0056b3;">paypal.com/businessmanage</a></li>
                </ol>
                <p style="margin-top: 15px; font-size: 14px;">
                  <strong>Quick Setup:</strong><br>
                  1. Go to <a href="https://developer.paypal.com" target="_blank" style="color: #0056b3;">PayPal Developer Dashboard</a><br>
                  2. Create Sandbox App<br>
                  3. Copy Client ID and Secret<br>
                  4. Add to your .env file
                </p>
              </div>
            `;
          }
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
        createOrder: async (_data: any) => {
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
