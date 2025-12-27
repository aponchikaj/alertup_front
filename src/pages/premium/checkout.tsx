import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import NowPaymentsButton from "../../components/nowpaymentsBtn";
import { getMe } from "../../apis/me";
import { Get_Premium_Plans } from "../../apis/premium";

interface PremiumPlan {
  key: string;
  price: number;
  name: string;
  invoiceId?: string;
  link?: string;
}

const Checkout = () => {
  const { plan } = useParams<{ plan: string }>();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getMe();
      if (!res?.Success) navigate("/login");
    })();
  }, []);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        const res = await Get_Premium_Plans();
        if (!res || res.Success === false) {
          navigate("/premium");
          return;
        }

        const plans: PremiumPlan[] = Object.entries(res.Message).map(
          ([key, value]: any) => ({
            key,
            price: value.price,
            name: value.name,
            invoiceId: value.invoiceId,
            link: value.link
          })
        );

        const match = plans.find(p => p.key.toLowerCase() === plan?.toLowerCase());
        if (!match) {
          navigate("/premium");
          return;
        }
        setSelectedPlan(match);
      } catch (err) {
        console.error("Error loading plan:", err);
        navigate("/premium");
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [plan, navigate]);

  if (loading) return <div className="min-h-screen bg-[#353535] flex items-center justify-center text-white">Loading...</div>;
  if (!selectedPlan) return null;

  return (
    <div className="min-h-screen bg-[#353535] flex flex-col items-center justify-center text-white px-4">
      <h1 className="text-2xl font-bold mb-2">{selectedPlan.name}</h1>
      <p className="text-lg mb-6">${selectedPlan.price} - 1 Month Premium Access</p>
      <div className="mb-4 max-w-md w-full">
        <NowPaymentsButton plan={selectedPlan.key} price={selectedPlan.price} />

        {selectedPlan.invoiceId && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <a
              href={`https://nowpayments.io/payment/?iid=${selectedPlan.invoiceId}&source=button`}
              target="_blank"
              rel="noreferrer noopener"
            >
              <img
                src="https://nowpayments.io/images/embeds/payment-button-white.svg"
                alt="Cryptocurrency & Bitcoin payment button by NOWPayments"
                style={{ maxWidth: 260 }}
              />
            </a>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-400 mt-4 text-center max-w-md">
        Having payment issues? Please contact support or try again later.
      </p>
    </div>
  );
};

export default Checkout;
