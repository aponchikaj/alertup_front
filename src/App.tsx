import { Route, Routes } from "react-router-dom";
import Navbar from "./components/navbar";
import Footer from "./components/footer";

// Pages
import Home from "./pages/home";
import Scan from "./pages/scan/scan";
import Contact from "./pages/contact/contact";
import Register from "./pages/auth/register";
import Login from "./pages/auth/login";
import Premium from "./pages/premium/premium";
import Reset from "./pages/reset/reset";
import Dashboard from "./pages/dashboard/dashboard";
import NewBuilding from "./pages/buildings/newBuilding";
import Mybuildings from "./pages/buildings/mybuildings";
import Checkout from "./pages/premium/checkout";
import Building from "./pages/buildings/building";
import Floor from "./pages/buildings/floor";
import Settings from "./pages/settings/settings";
import PageNotFound from "./pages/other/pageNotFound";

// Guards
import GuestGuard from "./guards/guestguard";
import AuthGuard from "./guards/authguard";
import ServerGate from "./pages/other/loading"; // move it here (recommended)


const App = () => {

  return (
    <>
      <Navbar  />

      <ServerGate>
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
      </ServerGate>

      <Footer />
    </>
  );
};

export default App;
