import { Navigate, useParams } from "react-router-dom";
import { getMe } from "../apis/me";
import { useEffect, useState } from "react";
import axios from "axios";

const BuildingOwnerGuard = ({ children }: { children: any }) => {
  const [isOwner, setIsOwner] = useState<boolean | null>(null); // null = loading
  const [user, setUser] = useState<any>(null);
  const { buildingId } = useParams<{ buildingId: string }>();

  useEffect(() => {
    const checkOwnership = async () => {
      try {
        // First check if user is authenticated
        const meRes = await getMe();
        if (!meRes || meRes.Success === false) {
          setIsOwner(false);
          return;
        }

        // Get user data from the correct location in response
        const userData = meRes.user || meRes.Message?.user || meRes.Message;
        if (!userData || !userData._id) {
          setIsOwner(false);
          return;
        }

        setUser(userData);

        // If no buildingId provided, just check authentication
        if (!buildingId) {
          setIsOwner(true);
          return;
        }

        // Check if user owns the specific building
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://alertup-backend.onrender.com';
        const buildingRes = await axios.get(`${API_BASE_URL}/api/building/id/${buildingId}`);
        
        if (buildingRes.data.Success && buildingRes.data.Message.owner === userData._id) {
          setIsOwner(true);
        } else {
          setIsOwner(false);
        }
      } catch (error) {
        console.error('Ownership check failed:', error);
        setIsOwner(false);
      }
    };

    checkOwnership();
  }, [buildingId]);

  // while checking ownership, render loading spinner
  if (isOwner === null) return <div className="text-center mt-20">Loading...</div>;

  // if not authenticated, redirect to login
  if (!user) return <Navigate to="/login" replace />;

  // if not owner, redirect to dashboard
  if (!isOwner) return <Navigate to="/dashboard" replace />;

  return children;
};

export default BuildingOwnerGuard;
