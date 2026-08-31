import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import authService from '../services/authService';

/**
 * Auth Store (Zustand)
 * Global state management for authentication
 */

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      // Starts true (not false) so the very first render never briefly
      // trusts stale/persisted auth state before loadUser()'s real
      // /auth/me response lands — see the `partialize` comment below for
      // the full XAVFSIZLIK-AUDIT.md O-11 reasoning this pairs with.
      isLoading: true,
      error: null,

      /**
       * Login action
       */
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { user } = await authService.login(email, password);
          set({ user, isAuthenticated: true, isLoading: false });
          return user;
        } catch (error) {
          const message = error.response?.data?.message || 'Login failed';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      /**
       * Register action
       */
      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const { user } = await authService.register(data);
          set({ user, isAuthenticated: true, isLoading: false });
          return user;
        } catch (error) {
          const message = error.response?.data?.message || 'Registration failed';
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      /**
       * Logout action
       */
      logout: async () => {
        try {
          await authService.logout();
        } finally {
          set({ user: null, isAuthenticated: false, error: null });
        }
      },

      /**
       * Load current user
       */
      loadUser: async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          // XAVFSIZLIK-AUDIT.md (production incident, 2026-08-31): bu qator
          // `isLoading: false`siz qoldirilgan edi — token yo'q holatda (ya'ni
          // HAR QANDAY hali login qilmagan tashrif buyuruvchi uchun)
          // `isLoading` abadiy `true` bo'lib qolardi, chunki uni boshqa hech
          // narsa qaytarmaydi. AppRouter esa BUTUN ilovani (hatto /login
          // marshrutining o'zini ham) `isLoading`ga bog'lab qo'ygan —
          // natijada production'da HECH KIM sahifani ochib bo'lmasdi,
          // abadiy "Yuklanmoqda..." holatida qolardi. Jonli aniqlandi va
          // shu zahoti tuzatildi.
          set({ isAuthenticated: false, user: null, isLoading: false });
          return;
        }

        set({ isLoading: true });
        try {
          const user = await authService.getCurrentUser();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          localStorage.removeItem('accessToken');
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      /**
       * Clear error
       */
      clearError: () => set({ error: null }),

      /**
       * Check if user has role
       */
      hasRole: (role) => {
        const { user } = get();
        return user?.role === role;
      },

      /**
       * Check if user has any of roles
       */
      hasAnyRole: (roles) => {
        const { user } = get();
        return roles.includes(user?.role);
      },
    }),
    {
      name: 'auth-storage',
      // XAVFSIZLIK-AUDIT.md O-11: `user` (role included) and
      // `isAuthenticated` used to be persisted straight into localStorage
      // — editable in DevTools (`role: "SUPER_ADMIN"`) with zero
      // protection beyond every backend route consistently remembering to
      // call authorize() (which they do today, but that's an invariant to
      // maintain forever across every future route, not a guarantee).
      // Nothing is persisted now: every load goes through loadUser()'s
      // real /auth/me response instead (see AppRouter.jsx's useEffect +
      // the isLoading default above, which together ensure nothing ever
      // renders off stale/tampered state first). The backend was always
      // the actual authority — this only removes a client-side surface
      // that never needed to exist.
      partialize: () => ({}),
    }
  )
);

export default useAuthStore;
