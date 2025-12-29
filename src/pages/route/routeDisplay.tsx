import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

const RouteDisplay = () => {
  const { qrId } = useParams<{ qrId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the correct scan page
    if (qrId) {
      navigate(`/scan/route/${qrId}`, { replace: true });
    }
  }, [qrId, navigate]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-[#353535] text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
        <p>Redirecting to emergency route...</p>
      </div>
    </div>
  );
};

export default RouteDisplay;
