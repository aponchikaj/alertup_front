import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import GuestGuard from "./guards/Guestguard";
import AuthGuard from "./guards/Authguard";
import PermissionGuard from "./guards/PermissionGuard";
import ServerGate from "./pages/other/Loading";
import { Analytics } from "@vercel/analytics/react";
import Seo from "./seo/Seo";
import { SpinnerIcon } from "./components/ui/Icons";

// Lazy-loaded pages
const Home = lazy(() => import("./pages/Home"));
// FX-064: owner-only pages, lazy like every other page (they were the only
// eager ones, so every visitor downloaded them with the entry chunk).
const Logs = lazy(() => import("./pages/buildings/Logs"));
const AnalyticsPage = lazy(() => import("./pages/buildings/Analytics"));
const EmergencyAnalytics = lazy(() => import("./pages/buildings/EmergencyAnalytics"));
const Scan = lazy(() => import("./pages/scan/Scan"));
const QRScanRoutePage = lazy(() => import("./pages/qr/QrScanRoutePage"));
const Contact = lazy(() => import("./pages/contact/Contact"));
const Register = lazy(() => import("./pages/auth/Register"));
const Login = lazy(() => import("./pages/auth/Login"));
const Reset = lazy(() => import("./pages/reset/Reset"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const NewBuilding = lazy(() => import("./pages/buildings/NewBuilding"));
const Mybuildings = lazy(() => import("./pages/buildings/Mybuildings"));
const MapEditor = lazy(() => import("./pages/buildings/mapEditor/MapEditorPage"));
const Building = lazy(() => import("./pages/buildings/Building"));
const Floor = lazy(() => import("./pages/buildings/Floor"));
const Settings = lazy(() => import("./pages/settings/Settings"));
const Members = lazy(() => import("./pages/buildings/Members"));
const InviteAccept = lazy(() => import("./pages/invite/InviteAccept"));
const PageNotFound = lazy(() => import("./pages/other/PageNotFound"));
const DesignGallery = lazy(() => import("./pages/other/DesignGallery"));
const Pricing = lazy(() => import("./pages/pricing/Pricing"));
const Help = lazy(() => import("./pages/help/Help"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const Cookies = lazy(() => import("./pages/legal/Cookies"));
const Security = lazy(() => import("./pages/legal/Security"));
const Accessibility = lazy(() => import("./pages/legal/Accessibility"));

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
              path="/building/:buildingId"
              element={
                <Building />
              }
            />
            <Route
              path="/building/:buildingId/:floor"
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
                // Any member may read the live log (the API's requireMembership);
                // the page shows the API's 403 to anyone else.
                <AuthGuard>
                  <Logs />
                </AuthGuard>
              }
            />

            <Route
              path="/building/:buildingId/analytics"
              element={
                <PermissionGuard permission="CAN_VIEW_ANALYTICS">
                  <AnalyticsPage />
                </PermissionGuard>
              }
            />

            <Route
              path="/building/:buildingId/:emergencyId/analytics"
              element={
                <PermissionGuard permission="CAN_VIEW_ANALYTICS">
                  <EmergencyAnalytics />
                </PermissionGuard>
              }
            />

            {/* Catch-all */}
            {/* Unlisted design-system reference. Not in the nav, not in the
                sitemap, no data access. */}
            <Route path="/_design" element={<DesignGallery />} />
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
