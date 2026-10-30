import { StrictMode, lazy, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import "./styles/app.css";
import { pageMeta } from "@pmw/engine";
import { StoreProvider, useStore } from "./lib/store.tsx";
import { SaveState } from "./components/bits.tsx";
import { Home } from "./pages/Home.tsx";
import { Onboarding } from "./pages/Onboarding.tsx";
import { Workbook } from "./pages/Workbook.tsx";
import { Save } from "./pages/Save.tsx";
import { Privacy } from "./pages/Privacy.tsx";
import { Settings } from "./pages/Settings.tsx";

const Plan = lazy(() => import("./pages/Plan.tsx").then((m) => ({ default: m.Plan })));
const Admin = lazy(() => import("./admin/Admin.tsx").then((m) => ({ default: m.Admin })));

function TopBar() {
  const { config, ws, me } = useStore();
  const loc = useLocation();
  const inWorkbook = loc.pathname.startsWith("/workbook");
  if (loc.pathname === "/") return null;
  return (
    <header className={`topbar no-print ${inWorkbook ? "wb" : ""}`}>
      <Link to="/" className="brand">
        <span className="eyebrow-brand">Workbook</span>
        <span className="side-title" style={{ margin: 0 }}>
          {config?.brandName ?? ""}
        </span>
      </Link>
      <span className="spacer" />
      <SaveState />
      {ws?.onboarding_done_at && !inWorkbook && (
        <Link className="btn small" to={`/workbook/${ws.last_section || "three-cs"}`}>
          Workbook
        </Link>
      )}
      {ws?.onboarding_done_at && (
        <Link className="btn small" to="/plan">
          My Plan
        </Link>
      )}
      {me && !me.user.saved && ws?.onboarding_done_at && (
        <Link className="btn small primary" to="/save">
          Save
        </Link>
      )}
      <Link className="btn small ghost" to="/settings" aria-label="Settings">
        ⚙
      </Link>
    </header>
  );
}

function App() {
  const { loading, config } = useStore();
  const { pathname } = useLocation();
  // Same titles the Worker writes into the page, kept in step as people move around.
  useEffect(() => {
    if (config) document.title = pageMeta(pathname, config.brandName).title;
  }, [pathname, config]);
  // Writing help buttons disappear when it's switched off or not connected; the workbook works the same.
  document.body.classList.toggle("no-assist", !!config && !config.assistEnabled);
  return (
    <>
      <TopBar />
      {loading ? (
        <div className="page muted">Loading your workbook...</div>
      ) : (
        <Suspense fallback={<div className="page muted">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/workbook" element={<Navigate to="/workbook/three-cs" replace />} />
            <Route path="/workbook/:sectionId" element={<Workbook />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/save" element={<Save />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      )}
    </>
  );
}

function Root() {
  // The admin area is separate: it never creates a visitor session or workspace.
  if (location.pathname.startsWith("/admin"))
    return (
      <Suspense fallback={<div className="page muted">Loading...</div>}>
        <Admin />
      </Suspense>
    );
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>,
);
