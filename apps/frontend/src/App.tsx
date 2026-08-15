import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
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
      <Route path="/call-display" component={CallDisplay} />
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
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      </Route>

      <Route path="/service-center">
        <PrivateRoute>
          <ServiceCenter />
        </PrivateRoute>
      </Route>

      <Route path="/visits/new">
        <PrivateRoute>
          <VisitNew />
        </PrivateRoute>
      </Route>

      <Route path="/visits/:id">
        <PrivateRoute>
          <VisitDetail />
        </PrivateRoute>
      </Route>

      <Route path="/visits">
        <PrivateRoute>
          <Visits />
        </PrivateRoute>
      </Route>

      <Route path="/visitors/new">
        <PrivateRoute>
          <VisitorNew />
        </PrivateRoute>
      </Route>

      <Route path="/visitors/:id">
        <PrivateRoute>
          <VisitorDetail />
        </PrivateRoute>
      </Route>

      <Route path="/visitors">
        <PrivateRoute>
          <Visitors />
        </PrivateRoute>
      </Route>

      <Route path="/sectors">
        <PrivateRoute adminOnly>
          <Sectors />
        </PrivateRoute>
      </Route>

      <Route path="/users">
        <PrivateRoute adminOnly>
          <Users />
        </PrivateRoute>
      </Route>

      <Route path="/config/fields">
        <PrivateRoute adminOnly>
          <ConfigFields />
        </PrivateRoute>
      </Route>

      <Route path="/config/label">
        <PrivateRoute adminOnly>
          <ConfigLabel />
        </PrivateRoute>
      </Route>

      <Route path="/reports">
        <PrivateRoute>
          <Reports />
        </PrivateRoute>
      </Route>

      <Route path="/audit">
        <PrivateRoute adminOnly>
          <AuditLogs />
        </PrivateRoute>
      </Route>

      <Route path="/backup">
        <PrivateRoute adminOnly>
          <Backup />
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
        <TooltipProvider>
          <WouterRouter base="">
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
