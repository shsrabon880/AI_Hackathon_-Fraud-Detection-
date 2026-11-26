import React, { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { FraudShieldAssistant } from "./components/FraudShieldAssistant";
import { LanguageSelector } from "./components/LanguageSelector";
import { NotificationCenter } from "./components/NotificationCenter";
import { Sidebar } from "./components/Sidebar";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { RiskDecisionProvider } from "./context/RiskDecisionContext";
import { LoginPage } from "./pages/LoginPage";

// Route-based code splitting for fast initial load & mobile performance
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const RecipientLookupSection = lazy(() =>
  import("./components/RecipientLookupSection").then((m) => ({
    default: m.RecipientLookupSection,
  }))
);
const ConnectorsPage = lazy(() =>
  import("./pages/ConnectorsPage").then((m) => ({ default: m.ConnectorsPage }))
);
const DevicesPage = lazy(() =>
  import("./pages/DevicesPage").then((m) => ({ default: m.DevicesPage }))
);
const SecurityPoliciesPage = lazy(() =>
  import("./pages/SecurityPoliciesPage").then((m) => ({ default: m.SecurityPoliciesPage }))
);
const ServicesPage = lazy(() =>
  import("./pages/ServicesPage").then((m) => ({ default: m.ServicesPage }))
);
const SessionsPage = lazy(() =>
  import("./pages/SessionsPage").then((m) => ({ default: m.SessionsPage }))
);
const SystemUsersPage = lazy(() =>
  import("./pages/SystemUsersPage").then((m) => ({ default: m.SystemUsersPage }))
);
const TransactionHistoryPage = lazy(() =>
  import("./pages/TransactionHistoryPage").then((m) => ({ default: m.TransactionHistoryPage }))
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage }))
);
const AlertsPage = lazy(() =>
  import("./pages/SecondaryPages").then((m) => ({ default: m.AlertsPage }))
);
const AnalyticsPage = lazy(() =>
  import("./pages/SecondaryPages").then((m) => ({ default: m.AnalyticsPage }))
);
const AuditLogsPage = lazy(() =>
  import("./pages/SecondaryPages").then((m) => ({ default: m.AuditLogsPage }))
);
const GraphNetworkPage = lazy(() =>
  import("./pages/SecondaryPages").then((m) => ({ default: m.GraphNetworkPage }))
);
const InvestigationPage = lazy(() =>
  import("./pages/SecondaryPages").then((m) => ({ default: m.InvestigationPage }))
);

const RouteFallback: React.FC = () => (
  <div className="p-8 text-xs text-slate-400">Loading module...</div>
);

const ProtectedShell: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060913] flex items-center justify-center text-sm text-slate-400">
        Initializing FinSphere AI – FraudShield...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <RiskDecisionProvider>
      <div className="min-h-screen bg-[#060913] text-slate-100 flex overflow-x-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Desktop Top Utility Bar: Language Selector + Real-Time Notification Center */}
          <div className="hidden md:flex h-12 px-6 border-b border-[#141b2e] bg-[#080c17]/75 items-center justify-between gap-3">
            <span className="text-[11px] font-medium text-slate-400 tracking-wide">
              FinSphere AI – FraudShield • Predict. Explain. Prevent. Protect.
            </span>
            <div className="flex items-center gap-3">
              <LanguageSelector compact />
              <NotificationCenter />
            </div>
          </div>

          <main className="flex-1 min-w-0 overflow-y-auto px-4 pt-16 pb-20 md:p-5 lg:p-6">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/users" element={<SystemUsersPage />} />
                <Route path="/devices" element={<DevicesPage />} />
                <Route path="/connectors" element={<ConnectorsPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/policies" element={<SecurityPoliciesPage />} />
                <Route path="/sessions" element={<SessionsPage />} />
                <Route path="/transactions" element={<TransactionHistoryPage />} />
                <Route path="/investigation" element={<InvestigationPage />} />
                <Route path="/recipient-lookup" element={<RecipientLookupSection />} />
                <Route path="/graph" element={<GraphNetworkPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
        <FraudShieldAssistant />
      </div>
    </RiskDecisionProvider>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <ProtectedShell />
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
