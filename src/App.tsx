import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import GuestGuard from "./guards/guestguard";
import AuthGuard from "./guards/authguard";
import BuildingOwnerGuard from "./guards/buildingOwnerGuard";
import ServerGate from "./pages/other/loading";
import { Analytics } from "@vercel/analytics/react";
import Logs from "./pages/buildings/logs";

// Lazy-loaded pages
const Home = lazy(() => import("./pages/home"));
const Scan = lazy(() => import("./pages/scan/scan"));
const QRScanRoutePage = lazy(() => import("./pages/qr/qrScanRoutePageFixed"));
const Contact = lazy(() => import("./pages/contact/contact"));
const Register = lazy(() => import("./pages/auth/register"));
const Login = lazy(() => import("./pages/auth/login"));
const Reset = lazy(() => import("./pages/reset/reset"));
const Dashboard = lazy(() => import("./pages/dashboard/dashboard"));
const NewBuilding = lazy(() => import("./pages/buildings/newBuilding"));
const Mybuildings = lazy(() => import("./pages/buildings/mybuildings"));
const NodeManager = lazy(() => import("./pages/buildings/nodeManager"));
const Building = lazy(() => import("./pages/buildings/building"));
const Floor = lazy(() => import("./pages/buildings/floor"));
const RouteDisplay = lazy(() => import("./pages/route/routeDisplay"));
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
            <Route path="/scan/route/:qrId" element={<QRScanRoutePage />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/route/:qrId" element={<RouteDisplay />} />

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
            <Route
              path="/building/:buildingID"
              element={
                <Building />
              }
            />
            <Route
              path="/building/:id/:floor"
              element={
                <Floor />
              }
            />
            <Route
              path="/building/:buildingId/nodes"
              element={
                <AuthGuard>
                  <BuildingOwnerGuard>
                    <NodeManager />
                  </BuildingOwnerGuard>
                </AuthGuard>
              }
            />

            <Route
              path="/building/:buildingId/logs"
              element={
                <AuthGuard>
                  <BuildingOwnerGuard>
                    <Logs />
                  </BuildingOwnerGuard>
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
