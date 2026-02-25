import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Profits from "@/pages/profits";
import Expenses from "@/pages/expenses";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import Finance from "@/pages/finance";
import Products from "@/pages/products";
import Inventory from "@/pages/inventory";
import Invoice from "@/pages/invoice";
import Sales from "@/pages/sales";
import Credits from "@/pages/credits";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar - hidden on mobile */}
      {!isMobile && <Sidebar />}
      
      {/* Mobile sidebar (hamburger menu) - rendered by Sidebar component itself */}
      {isMobile && <Sidebar />}
      
      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

function RoleProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar - hidden on mobile */}
      {!isMobile && <Sidebar />}
      
      {/* Mobile sidebar (hamburger menu) - rendered by Sidebar component itself */}
      {isMobile && <Sidebar />}
      
      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login">
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Route>

      {/* Root redirect */}
      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>

      {/* Protected routes */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/invoice">
        <ProtectedRoute>
          <Invoice />
        </ProtectedRoute>
      </Route>

      <Route path="/sales">
        <RoleProtectedRoute allowedRoles={["owner", "customer_service", "receptionist", "stock_manager"]}>
          <Sales />
        </RoleProtectedRoute>
      </Route>

      <Route path="/profits">
        <RoleProtectedRoute allowedRoles={["owner"]}>
          <Profits />
        </RoleProtectedRoute>
      </Route>

      <Route path="/expenses">
        <RoleProtectedRoute allowedRoles={["owner"]}>
          <Expenses />
        </RoleProtectedRoute>
      </Route>

      <Route path="/credits">
        <RoleProtectedRoute allowedRoles={["owner"]}>
          <Credits />
        </RoleProtectedRoute>
      </Route>

      <Route path="/users">
        <RoleProtectedRoute allowedRoles={["owner"]}>
          <Users />
        </RoleProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      </Route>

      <Route path="/products">
        <ProtectedRoute>
          <Products />
        </ProtectedRoute>
      </Route>

      <Route path="/inventory">
        <ProtectedRoute>
          <Inventory />
        </ProtectedRoute>
      </Route>

      <Route path="/finance">
        <RoleProtectedRoute allowedRoles={["owner"]}>
          <Finance />
        </RoleProtectedRoute>
      </Route>

      {/* Fallback to 404 */}
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
