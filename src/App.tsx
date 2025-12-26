import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import GuestGuard from "./guards/guestguard";
import AuthGuard from "./guards/authguard";
import ServerGate from "./pages/other/loading";
import { Analytics } from "@vercel/analytics/react";

// Lazy-loaded pages
const Home = lazy(() => import("./pages/home"));
const Scan = lazy(() => import("./pages/scan/scan"));
const Contact = lazy(() => import("./pages/contact/contact"));
const Register = lazy(() => import("./pages/auth/register"));
const Login = lazy(() => import("./pages/auth/login"));
const Premium = lazy(() => import("./pages/premium/premium"));
const Reset = lazy(() => import("./pages/reset/reset"));
const Dashboard = lazy(() => import("./pages/dashboard/dashboard"));
const NewBuilding = lazy(() => import("./pages/buildings/newBuilding"));
const Mybuildings = lazy(() => import("./pages/buildings/mybuildings"));
const Checkout = lazy(() => import("./pages/premium/checkout"));
const Building = lazy(() => import("./pages/buildings/building"));
const Floor = lazy(() => import("./pages/buildings/floor"));
const Settings = lazy(() => import("./pages/settings/settings"));
const PageNotFound = lazy(() => import("./pages/other/pageNotFound"));

const App = () => {
  return (
    <>
      <Navbar />

      <ServerGate>
        <Suspense fallback={<div className="text-center mt-20">Loading...</div>}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/building/:buildingID" element={<Building />} />
            <Route path="/building/:id/:floor" element={<Floor />} />

            {/* Guest-only Routes */}
            <Route
              path="/register"
              element={
                <GuestGuard>
                  <Register />
                </GuestGuard>
              }
            />
            <Route
              path="/login"
              element={
                <GuestGuard>
                  <Login />
                </GuestGuard>
              }
            />
            <Route
              path="/reset"
              element={
                <GuestGuard>
                  <Reset />
                </GuestGuard>
              }
            />

            {/* Auth-only Routes */}
            <Route
              path="/checkout/:plan"
              element={
                <AuthGuard>
                  <Checkout />
                </AuthGuard>
              }
            />
            <Route
              path="/dashboard"
              element={
                <AuthGuard>
                  <Dashboard />
                </AuthGuard>
              }
            />
            <Route
              path="/new"
              element={
                <AuthGuard>
                  <NewBuilding />
                </AuthGuard>
              }
            />
            <Route
              path="/mybuildings"
              element={
                <AuthGuard>
                  <Mybuildings />
                </AuthGuard>
              }
            />
            <Route
              path="/settings"
              element={
                <AuthGuard>
                  <Settings />
                </AuthGuard>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </ServerGate>

      {/* Analytics */}
      <Analytics />

      <Footer />
    </>
  );
};

export default App;
