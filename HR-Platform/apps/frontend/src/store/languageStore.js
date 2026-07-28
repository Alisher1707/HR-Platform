import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Language Store (Zustand)
 * UI-level language selector — persists the chosen language code.
 * Interface strings are not translated yet; this only drives the
 * header language switcher's displayed value.
 */

export const LANGUAGES = [
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

export const useLanguageStore = create(
  persist(
    (set) => ({
      language: 'uz',

      setLanguage: (code) => set({ language: code }),
    }),
    {
      name: 'language-storage',
    }
  )
);

export default useLanguageStore;
