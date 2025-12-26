// src/guards/GuestGuard.js
import { Navigate } from "react-router-dom";
import { getMe } from "../apis/me";
import { useEffect, useState } from "react";

const GuestGuard = ({ children }: { children: any }) => {
  const [user, setUser] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await getMe();
        if (!res || res.Success === false) {
          setUser(false); // not logged in → allow access
          return;
        }
        setUser(true); // logged in → redirect
      } catch {
        setUser(false);
      }
    };

    checkUser();
  }, []);

  // while checking auth, show a loading spinner or null
  if (user === null) return <div>Loading...</div>;

  if (user) return <Navigate to="/dashboard" replace />; // redirect if logged in

  return children;
};

export default GuestGuard;
