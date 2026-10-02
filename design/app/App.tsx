import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { CategoriesProvider } from './providers/categories-provider';
import { UserProvider } from './providers/user-provider';
import { PreferencesProvider } from './lib/preferences';

export default function App() {
  return (
    <PreferencesProvider>
      <UserProvider>
        <CategoriesProvider>
          <RouterProvider router={router} />
          <Toaster />
        </CategoriesProvider>
      </UserProvider>
    </PreferencesProvider>
  );
}