import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import GuestGuard from "./guards/guestguard";
import AuthGuard from "./guards/authguard";
import BuildingOwnerGuard from "./guards/buildingOwnerGuard";
import PermissionGuard from "./guards/permissionGuard";
import ServerGate from "./pages/other/loading";
import { Analytics } from "@vercel/analytics/react";
import Seo from "./seo/Seo";
import { SpinnerIcon } from "./components/ui/icons";
import Logs from "./pages/buildings/logs";
import AnalyticsPage from "./pages/buildings/analytics";
import EmergencyAnalytics from "./pages/buildings/emergencyAnalytics";

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
const MapEditor = lazy(() => import("./pages/buildings/mapEditor/mapEditorPage"));
const Building = lazy(() => import("./pages/buildings/building"));
const Floor = lazy(() => import("./pages/buildings/floor"));
const Settings = lazy(() => import("./pages/settings/settings"));
const Members = lazy(() => import("./pages/buildings/members"));
const InviteAccept = lazy(() => import("./pages/invite/inviteAccept"));
const PageNotFound = lazy(() => import("./pages/other/pageNotFound"));
const Pricing = lazy(() => import("./pages/pricing/pricing"));
const Help = lazy(() => import("./pages/help/help"));
const Privacy = lazy(() => import("./pages/legal/privacy"));
const Terms = lazy(() => import("./pages/legal/terms"));
const Cookies = lazy(() => import("./pages/legal/cookies"));
const Security = lazy(() => import("./pages/legal/security"));
const Accessibility = lazy(() => import("./pages/legal/accessibility"));

/**
 * Older QR codes were generated pointing at `/route/qr_...` while the current
 * ones point at `/scan/route/qr_...`. Those older codes may already be printed
 * and stuck on walls, so the legacy path is preserved as a redirect rather than
 * removed — a sign that 404s during a fire is not an acceptable outcome.
 */
const LegacyRouteRedirect = () => {
  const { qrId } = useParams<{ qrId: string }>();
  return <Navigate to={`/scan/route/${qrId}`} replace />;
};

const App = () => {
  return (
    <>
      {/* Route-level metadata safety net. Pages that render their own <Seo />
          take precedence; this guarantees every other route still gets its own
          title, description, canonical and robots directives instead of
          inheriting the previous page's. */}
      <Seo fallback />

      <Navbar />

      {/* One main landmark for the whole app. Every page renders sections, not
          their own <main> — assistive tech and crawlers both need exactly one. */}
      <main id="main">
      <ServerGate>
        <Suspense
          fallback={
            <div
              role="status"
              aria-label="Loading page"
              className="flex min-h-[60vh] items-center justify-center bg-canvas text-brand-text"
            >
              <SpinnerIcon size={28} />
            </div>
          }
        >
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/scan/route/:qrId" element={<QRScanRoutePage />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/route/:qrId" element={<LegacyRouteRedirect />} />

            {/* Invitation landing page. Public on purpose: the recipient may
                not have an account yet, and the page itself decides whether to
                offer sign-in, refuse a mismatched account, or accept. */}
            <Route path="/invite/accept" element={<InviteAccept />} />

            <Route path="/pricing" element={<Pricing />} />
            <Route path="/help" element={<Help />} />

            {/* Legal & policy — linked from the footer on every page. */}
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/security" element={<Security />} />
            <Route path="/accessibility" element={<Accessibility />} />

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
                <PermissionGuard permission="CAN_EDIT_MAP">
                  <MapEditor />
                </PermissionGuard>
              }
            />

            {/* Team & permissions. AuthGuard only — the page itself decides
                which tabs and controls the viewer's permissions justify. */}
            <Route
              path="/building/:buildingId/members"
              element={
                <AuthGuard>
                  <Members />
                </AuthGuard>
              }
            />

            <Route
              path="/building/:buildingId/logs"
              element={
                <BuildingOwnerGuard>
                  <Logs />
                </BuildingOwnerGuard>
              }
            />

            <Route
              path="/building/:buildingId/analytics"
              element={
                <BuildingOwnerGuard>
                  <AnalyticsPage />
                </BuildingOwnerGuard>
              }
            />

            <Route
              path="/building/:buildingId/:emergencyId/analytics"
              element={
                <BuildingOwnerGuard>
                  <EmergencyAnalytics />
                </BuildingOwnerGuard>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </ServerGate>
      </main>

      {/* Analytics */}
      <Analytics />

      <Footer />
    </>
  );
};

export default App;
