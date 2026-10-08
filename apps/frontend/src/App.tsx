import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { RealtimeProvider } from "@/contexts/RealtimeProvider";
import { ExitGuardProvider } from "@/contexts/ExitGuard";
import { PrivateRoute } from "@/components/PrivateRoute";

import Login from "@/pages/login";
import ChangePassword from "@/pages/change-password";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Visits from "@/pages/visits/index";
import VisitNew from "@/pages/visits/new";
import VisitDetail from "@/pages/visits/detail";
import Visitors from "@/pages/visitors/index";
import VisitorNew from "@/pages/visitors/new";
import VisitorDetail from "@/pages/visitors/detail";
import Sectors from "@/pages/sectors";
import Users from "@/pages/users";
import ConfigFields from "@/pages/config/fields";
import ConfigLabel from "@/pages/config/label";
import Reports from "@/pages/reports";
import AuditLogs from "@/pages/audit";
import NotFound from "@/pages/not-found";
import NoAccess from "@/pages/no-access";
import ServiceCenter from "@/pages/service-center";
import CallDisplay from "@/pages/call-display";
import Backup from "@/pages/backup";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/call-display">
        <PrivateRoute permission="viewCallDisplay">
          <CallDisplay />
        </PrivateRoute>
      </Route>
      <Route path="/change-password">
        <PrivateRoute allowPasswordChange>
          <ChangePassword />
        </PrivateRoute>
      </Route>
      <Route path="/">
        <PrivateRoute>
          <Home />
        </PrivateRoute>
      </Route>

      <Route path="/dashboard">
        <PrivateRoute permission="viewDashboard">
          <Dashboard />
        </PrivateRoute>
      </Route>

      <Route path="/service-center">
        <PrivateRoute permission="accessServiceCenter">
          <ServiceCenter />
        </PrivateRoute>
      </Route>

      <Route path="/visits/new">
        <PrivateRoute permission="registerVisit">
          <VisitNew />
        </PrivateRoute>
      </Route>

      <Route path="/visits/:id">
        <PrivateRoute permission={["viewVisits", "registerVisit"]}>
          <VisitDetail />
        </PrivateRoute>
      </Route>

      <Route path="/visits">
        <PrivateRoute permission="viewVisits">
          <Visits />
        </PrivateRoute>
      </Route>

      <Route path="/visitors/new">
        <PrivateRoute permission="createVisitor">
          <VisitorNew />
        </PrivateRoute>
      </Route>

      <Route path="/visitors/:id">
        <PrivateRoute permission="viewVisitors">
          <VisitorDetail />
        </PrivateRoute>
      </Route>

      <Route path="/visitors">
        <PrivateRoute permission="viewVisitors">
          <Visitors />
        </PrivateRoute>
      </Route>

      <Route path="/sectors">
        <PrivateRoute permission="manageSectors">
          <Sectors />
        </PrivateRoute>
      </Route>

      <Route path="/users">
        <PrivateRoute adminOnly>
          <Users />
        </PrivateRoute>
      </Route>

      <Route path="/config/fields">
        <PrivateRoute permission="manageSettings">
          <ConfigFields />
        </PrivateRoute>
      </Route>

      <Route path="/config/label">
        <PrivateRoute permission="manageSettings">
          <ConfigLabel />
        </PrivateRoute>
      </Route>

      <Route path="/reports">
        <PrivateRoute permission="viewReports">
          <Reports />
        </PrivateRoute>
      </Route>

      <Route path="/audit">
        <PrivateRoute permission="viewAudit">
          <AuditLogs />
        </PrivateRoute>
      </Route>

      <Route path="/backup">
        <PrivateRoute adminOnly>
          <Backup />
        </PrivateRoute>
      </Route>

      <Route path="/no-access">
        <PrivateRoute>
          <NoAccess />
        </PrivateRoute>
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>
          <TooltipProvider>
            <ExitGuardProvider>
              <WouterRouter base="">
                <Router />
              </WouterRouter>
            </ExitGuardProvider>
            <Toaster />
          </TooltipProvider>
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
