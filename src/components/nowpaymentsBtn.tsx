import { useState } from "react";
import { CreateOrder } from "../apis/premium";

interface Props {
  plan: string; // Plan name: Basic, Platinum, Elite, Professional
  price: number;
}

const NowPaymentsButton = ({ plan, price }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("USDT");

  const handlePayment = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Initiating payment for plan:", plan);
      
      // Get payment link from backend
      const response = await CreateOrder(plan);
      console.log("Payment response:", response);

      if (!response.Success) {
        const errorMsg = response.Message || "Failed to initialize payment";
        console.error("Backend error:", errorMsg);
        setError(errorMsg);
        return;
      }

      const { paymentLink } = response.Message;
      if (!paymentLink) {
        console.error("No payment link received");
        setError("Payment link not available");
        return;
      }

      // Redirect to NowPayments with selected stablecoin (append coin param)
      const separator = paymentLink.includes("?") ? "&" : "?";
      const target = `${paymentLink}${separator}coin=${encodeURIComponent(currency)}`;
      window.location.href = target;
    } catch (err: any) {
      console.error("Payment error:", err);
      const errorMsg = err.response?.data?.Message || err.message || "Payment failed";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#f8d7da",
            color: "#721c24",
            borderRadius: "4px",
            marginBottom: "12px",
            border: "1px solid #f5c6cb",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 8, fontSize: 14, color: '#ddd' }}>Pay with:</label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          style={{ padding: '6px 8px', borderRadius: 6 }}
        >
          <option value="USDT">USDT (Tether)</option>
          <option value="USDC">USDC (USD Coin)</option>
        </select>
      </div>

      <button
        onClick={handlePayment}
        disabled={loading}
        style={{
          padding: "12px 24px",
          backgroundColor: "#FF8500",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
          transition: "all 0.3s ease",
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            (e.target as HTMLButtonElement).style.backgroundColor = "#E67E00";
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            (e.target as HTMLButtonElement).style.backgroundColor = "#FF8500";
          }
        }}
      >
        {loading ? "Processing..." : `Pay ${price} USD with Crypto`}
      </button>

      <p style={{ marginTop: "12px", fontSize: "12px", color: "#666" }}>
        Powered by NowPayments.io - Pay with Bitcoin, Ethereum, and 200+ cryptocurrencies
      </p>
    </div>
  );
};

export default NowPaymentsButton;
