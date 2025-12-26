import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Get_Premium_Plans } from "../../apis/premium";

interface PremiumPlan {
  key: string; // Basic, Elite, etc (IMPORTANT)
  title: string;
  price: number;
  limits: {
    maxBuildings: number;
    maxFloors: number;
  };
  onSale: boolean;
  salePrice: number;
}

const Premium = () => {

  useEffect(() => {
      document.title = "Premium - AlertUp";
  }, []);
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const res = await Get_Premium_Plans();

        if (!res || res.Success === false) {
          setError(res?.Message || "Failed to load plans.");
          return;
        }

        // 🔥 FIX: object → array
        const normalizedPlans: PremiumPlan[] = Object.entries(res.Message).map(
          ([key, value]: any) => ({
            key,
            ...value,
          })
        );

        setPlans(normalizedPlans);
      } catch {
        setError("Server error.");
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, []);

  return (
    <main className="min-h-screen bg-[#353535] text-white px-4 py-16">

      <section className="w-full h-[10vh]">
        
      </section>

      {/* HEADER */}
      <section className="max-w-5xl mx-auto text-center mb-16">
        <h1 className="text-3xl md:text-5xl font-bold mb-4">
          Upgrade to <span className="text-[#FF7B22]">Premium</span>
        </h1>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Get more buildings, more floors, and professional safety analytics.
        </p>
      </section>

      {/* STATES */}
      {loading && (
        <p className="text-center text-gray-400">Loading plans...</p>
      )}

      {error && (
        <p className="text-center text-red-400">{error}</p>
      )}

      {/* PLANS */}
      {!loading && !error && (
        <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* FREE PLAN */}
          <div className="border border-gray-600 rounded-2xl p-8 flex flex-col gap-6">
            <h2 className="text-2xl font-semibold">Free</h2>
            <p className="text-gray-400 text-sm">
              Perfect for getting started
            </p>

            <ul className="text-sm text-gray-300 flex flex-col gap-3">
              <li>✔ Limited buildings</li>
              <li>✔ Escape maps</li>
              <li>✔ QR scanning</li>
              <li>✖ No analytics</li>
              <li>✖ Limited support</li>
            </ul>

            <div className="mt-auto">
              <span className="text-3xl font-bold">$0</span>
              <p className="text-gray-400 text-sm">Forever free</p>
            </div>
          </div>

          {/* PREMIUM PLANS */}
          {plans.map((plan,i) => {
            const price = plan.onSale ? plan.salePrice : plan.price;

            return (
              <div
                key={i}
                className="border-2 border-[#FF7B22] rounded-2xl p-8 flex flex-col gap-6 relative hover:scale-105 transition-all"
              >
                <span className="absolute top-4 right-4 text-xs bg-[#FF7B22] text-[#353535] px-3 py-1 rounded-full font-semibold">
                  PREMIUM
                </span>

                <h2 className="text-2xl font-semibold text-[#FF7B22]">
                  {plan.title}
                </h2>

                <ul className="text-sm text-gray-300 flex flex-col gap-3">
                  <li>✔ Max buildings: {plan.limits.maxBuildings}</li>
                  <li>✔ Max floors: {plan.limits.maxFloors}</li>
                  <li>✔ Advanced analytics</li>
                  <li>✔ Priority support</li>
                </ul>

                <div className="mt-auto">
                  <span className="text-3xl font-bold">${price}</span>
                  <span className="text-gray-400 text-sm"> / month</span>
                </div>

                <Link
                  to={`/checkout/${plan.key}`}
                  className="mt-4 w-full text-center py-3 rounded-full bg-[#FF7B22]
                             text-[#353535] font-semibold hover:opacity-90 transition"
                >
                  Upgrade Now
                </Link>
              </div>
            );
          })}
        </section>
      )}

      {/* FOOTER */}
      <section className="text-center mt-16 text-gray-400 text-sm">
        Need help?{" "}
        <Link to="/contact" className="text-[#FF7B22] hover:underline">
          Contact us
        </Link>
      </section>
    </main>
  );
};

export default Premium;
