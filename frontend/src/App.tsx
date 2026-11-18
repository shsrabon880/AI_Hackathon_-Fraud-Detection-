import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { FraudShieldAssistant } from "./components/FraudShieldAssistant";
import { Sidebar } from "./components/Sidebar";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RiskDecisionProvider } from "./context/RiskDecisionContext";
import { ConnectorsPage } from "./pages/ConnectorsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DevicesPage } from "./pages/DevicesPage";
import { LoginPage } from "./pages/LoginPage";
import {
  AlertsPage,
  AnalyticsPage,
  AuditLogsPage,
  GraphNetworkPage,
  InvestigationPage,
} from "./pages/SecondaryPages";
import { SecurityPoliciesPage } from "./pages/SecurityPoliciesPage";
import { ServicesPage } from "./pages/ServicesPage";
import { SessionsPage } from "./pages/SessionsPage";
import { SystemUsersPage } from "./pages/SystemUsersPage";
import { TransactionHistoryPage } from "./pages/TransactionHistoryPage";

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
      <div className="min-h-screen bg-[#060913] text-slate-100 flex">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-6">
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
            <Route path="/graph" element={<GraphNetworkPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <FraudShieldAssistant />
      </div>
    </RiskDecisionProvider>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProtectedShell />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
