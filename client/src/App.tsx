import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { AppShell } from './components/AppShell';
import { AuthPage } from './components/AuthPage';
import { SupportChatWidget } from './components/SupportChatWidget';
import { AccountSupportChat } from './components/AccountSupportChat';
import { Loading } from './components/UI';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import NotFound from './pages/NotFound';
import LegalPage from './pages/LegalPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordRecovery';

const Dashboard=lazy(()=>import('./pages/Dashboard'));
const Transactions=lazy(()=>import('./pages/Transactions'));
const Goals=lazy(()=>import('./pages/Goals'));
const Accounts=lazy(()=>import('./pages/Accounts'));
const Reports=lazy(()=>import('./pages/Reports'));
const Settings=lazy(()=>import('./pages/Settings'));
const Admin=lazy(()=>import('./pages/Admin'));

function AppRoutes() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage key="login" mode="login" />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage key="register" mode="register" />} />
        <Route path="/terms" element={<LegalPage type="terms" />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={user ? <AppShell /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={user?.isAdmin ? <Admin /> : <Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!user ? <SupportChatWidget /> : !user.isAdmin ? <AccountSupportChat /> : null}
    </Suspense>
  );
}
export default function App(){return <ToastProvider><ConfirmProvider><AuthProvider><AppRoutes/></AuthProvider></ConfirmProvider></ToastProvider>;}
