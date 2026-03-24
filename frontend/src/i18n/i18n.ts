import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';

export const languages = {
  en: { name: 'English', nativeName: 'English' },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon },
    },
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export const syncLanguageWithUserSettings = (language: string | undefined) => {
  if (language && Object.keys(languages).includes(language)) {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
    localStorage.setItem('i18nextLng', language);
  }
};

export default i18n;
