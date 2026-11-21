import { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastContainer } from './components/ToastContainer';
import { LoginPage } from './pages/LoginPage';
import { OrdersKanbanPage } from './pages/OrdersKanbanPage';
import { ProductsPage } from './pages/ProductsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PublicMenuPage } from './pages/PublicMenuPage';

function AppRouter() {
  const { currentPath, session, navigate } = useApp();

  const publicStoreMatch = currentPath.match(/^\/loja\/([^/]+)\/?$/);

  useEffect(() => {
    if (publicStoreMatch) return;

    const isAdminPrivateRoute =
      currentPath === '/admin/pedidos' ||
      currentPath === '/admin/produtos' ||
      currentPath === '/admin/configuracoes';

    if (isAdminPrivateRoute && !session) {
      navigate('/admin/login', true);
      return;
    }

    if (currentPath === '/admin/login' && session) {
      navigate('/admin/pedidos', true);
      return;
    }

    if (
      !isAdminPrivateRoute &&
      currentPath !== '/admin/login' &&
      !publicStoreMatch
    ) {
      navigate(session ? '/admin/pedidos' : '/admin/login', true);
    }
  }, [currentPath, session, navigate, publicStoreMatch]);

  if (publicStoreMatch) {
    const slug = decodeURIComponent(publicStoreMatch[1]);
    return <PublicMenuPage slug={slug} />;
  }

  if (currentPath === '/admin/login' || !session) {
    return <LoginPage />;
  }

  if (currentPath === '/admin/produtos') {
    return <ProductsPage />;
  }

  if (currentPath === '/admin/configuracoes') {
    return <SettingsPage />;
  }

  return <OrdersKanbanPage />;
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
      <ToastContainer />
    </AppProvider>
  );
}
