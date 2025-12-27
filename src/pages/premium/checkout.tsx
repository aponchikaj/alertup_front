import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SubscriptionButton from "../../components/paymentBtn";
import { getMe } from "../../apis/me";

const VALID_PLANS = [
  { name: "Basic", id: "P-11X27865HK279192ENFH7Q5Q" },
  { name: "Platinum", id: "P-2TG459541U474594GNFH7S6Y" },
  { name: "Elite", id: "P-8R946168441544305NFH7R7A" },
  { name: "Professional", id: "P-9TJ12709BF866930RNFH7TSQ" },
];

const Checkout = () => {
  const { plan } = useParams<{ plan: string }>();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<{ name: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getMe();
      if (!res?.Success) navigate("/login");
    })();
  }, []);

  useEffect(() => {
    const match = VALID_PLANS.find(p => p.name.toLowerCase() === plan?.toLowerCase());
    if (!match) {
      navigate("/premium");
      return;
    }
    setSelectedPlan(match);
    setLoading(false);
  }, [plan]);

  if (loading) return <div>Loading...</div>;
  if (!selectedPlan) return null;

  return (
    <div className="min-h-screen bg-[#353535] flex flex-col items-center justify-center text-white">
      <h1 className="text-2xl font-bold mb-4">{selectedPlan.name} Plan</h1>
      <SubscriptionButton planId={selectedPlan.id} />
    </div>
  );
};

export default Checkout;
