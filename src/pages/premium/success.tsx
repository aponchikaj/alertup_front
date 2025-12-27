import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const Success = () => {
  // const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Payment Success - AlertUp";

    const confirmSubscription = async () => {
      const params = new URLSearchParams(window.location.search);
      const subscriptionID = params.get("subscription_id");

      if (!subscriptionID) {
        setError("Invalid subscription");
        setLoading(false);
        return;
      }

      try {
        const res = (
          await axios.post(
            "/api/premium/confirm",
            { subscriptionID },
            { withCredentials: true }
          )
        ).data;

        if (!res.Success) {
          setError("Subscription verification failed");
        }
      } catch (err) {
        console.error(err);
        setError("Server error");
      } finally {
        setLoading(false);
      }
    };

    confirmSubscription();
  }, []);

  if (loading)
    return (
      <main className="min-h-screen bg-[#353535] text-white flex items-center justify-center">
        Activating your premium...
      </main>
    );

  if (error)
    return (
      <main className="min-h-screen bg-[#353535] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <Link to="/premium" className="text-[#FF7B22]">
          Back to plans
        </Link>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#353535] text-white flex items-center justify-center">
      <div className="bg-[#2c2c2c] p-10 rounded-2xl w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Subscription Active 🎉</h1>
        <p className="text-gray-300 mb-6">
          Your premium access has been successfully activated.
        </p>
        <Link
          to="/dashboard"
          className="inline-block px-6 py-2 bg-[#FF7B22] text-[#353535] rounded-full font-semibold"
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
};

export default Success;
