// src/guards/AuthGuard.js
import { Navigate } from "react-router-dom";
import { getMe } from "../apis/me";
import { useEffect, useState } from "react";

const AuthGuard = ({ children }: { children: any }) => {
  const [user, setUser] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    const getMyUser = async () => {
      try {
        const res = await getMe();
        if (!res || res.Success === false) {
          setUser(false);
          return;
        }
        setUser(true);
      } catch {
        setUser(false);
      }
    };

    getMyUser();
  }, []); // run once on mount

  // while checking auth, render nothing or a loading spinner
  if (user === null) return <div>Loading...</div>;

  if (!user) return <Navigate to="/login" replace />;

  return children;
};

export default AuthGuard;
