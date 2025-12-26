import { useEffect } from "react";
import { Link } from "react-router-dom";

const Success = () => {
  useEffect(() => {
    document.title = "Payment Success - AlertUp";
  }, []);

  return (
    <main className="min-h-screen bg-[#353535] text-white flex items-center justify-center">
      <div className="bg-[#2c2c2c] p-10 rounded-2xl w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Payment Successful</h1>
        <p className="text-gray-300 mb-6">Thank you — your premium access is now active.</p>
        <Link to="/dashboard" className="inline-block px-6 py-2 bg-[#FF7B22] text-[#353535] rounded-full font-semibold">
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
};

export default Success;
