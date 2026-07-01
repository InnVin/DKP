import { RouterProvider } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { router } from './routes';
import { AppStoreProvider } from './store/AppStore';

export default function App() {
  return (
    <ErrorBoundary>
      <AppStoreProvider>
        <RouterProvider router={router} />
      </AppStoreProvider>
    </ErrorBoundary>
  );
}
