import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./authContext";

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};

export default useAuth;
