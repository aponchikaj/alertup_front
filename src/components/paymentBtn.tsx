import { useEffect, useRef } from "react";

declare global {
  interface Window { paypal: any; }
}

interface Props {
  planId: string;
}

const SubscriptionButton = ({ planId }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!planId || !containerRef.current) return;

    // Clear previous buttons (important)
    containerRef.current.innerHTML = "";

    const loadPaypalScript = () => {
      return new Promise<void>((resolve) => {
        if (window.paypal) return resolve(); // already loaded

        const script = document.createElement("script");
        script.src = `https://www.paypal.com/sdk/js?client-id=AQ_vHdiFQWqEH2jJ3r-BZxSyjnqwOF_tAZai0KGvae6cQLZuQ1N6E6KVH9xt9fQMdtKNHOeSM2dzHaWQ&vault=true&intent=subscription`;
        script.async = true;
        script.onload = () => resolve();
        document.body.appendChild(script);
      });
    };

    loadPaypalScript().then(() => {
      if (!window.paypal || !containerRef.current) return;

      window.paypal.Buttons({
        style: { shape: "pill", color: "gold", layout: "vertical", label: "subscribe" },
        createSubscription: (_data: any, actions: any) => actions.subscription.create({ plan_id: planId }),
        onApprove: (data: any) => {
          alert(`Subscription successful! ID: ${data.subscriptionID}`);
          window.location.href = "/premium/success";
        },
        onError: (err: any) => {
          console.error("PayPal Button error:", err);
          alert("Payment failed. Check console for details.");
        },
      }).render(containerRef.current);
    });

    // Cleanup on unmount
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [planId]);

  return <div ref={containerRef}></div>;
};

export default SubscriptionButton;
