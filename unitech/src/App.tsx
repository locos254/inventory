import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Toaster } from 'react-hot-toast';

import { AuthGuard } from './components/auth-guard';

import Login from './pages/login';
import Dashboard from './pages/dashboard';
import Products from './pages/products';
import Sales from './pages/sales';
import Categories from './pages/categories';
import Brands from './pages/brands';
import ScreenTypes from './pages/screen-types';
import Reports from './pages/reports';
import Settings from './pages/settings';

import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <AuthGuard><Dashboard /></AuthGuard>
      </Route>
      <Route path="/products">
        <AuthGuard><Products /></AuthGuard>
      </Route>
      <Route path="/sales">
        <AuthGuard><Sales /></AuthGuard>
      </Route>
      <Route path="/categories">
        <AuthGuard><Categories /></AuthGuard>
      </Route>
      <Route path="/brands">
        <AuthGuard><Brands /></AuthGuard>
      </Route>
      <Route path="/screen-types">
        <AuthGuard><ScreenTypes /></AuthGuard>
      </Route>
      <Route path="/reports">
        <AuthGuard><Reports /></AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard><Settings /></AuthGuard>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
