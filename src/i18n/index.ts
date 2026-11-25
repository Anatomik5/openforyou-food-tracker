import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { getSetting, setSetting } from '../db';
import { en } from './en';
import { ru } from './ru';
import { de } from './de';

export type Language = 'ru' | 'de' | 'en';
export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
];

const LOCALES: Record<Language, string> = { ru: 'ru-RU', de: 'de-DE', en: 'en-US' };

function detectLanguage(): Language {
  const code = Localization.getLocales()[0]?.languageCode?.toLowerCase();
  return code === 'ru' ? 'ru' : code === 'de' ? 'de' : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ru: { translation: ru }, de: { translation: de } },
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

/** Applies the saved language (if any); otherwise keeps the system-detected one. */
export async function initLanguage(): Promise<void> {
  try {
    const saved = await getSetting('language');
    if (saved === 'ru' || saved === 'de' || saved === 'en') await i18n.changeLanguage(saved);
  } catch {
    // keep detected language
  }
}

export async function setLanguage(lng: Language): Promise<void> {
  await i18n.changeLanguage(lng);
  try {
    await setSetting('language', lng);
  } catch {
    // language still applies for this session
  }
}

export function currentLanguage(): Language {
  const l = i18n.language;
  return l === 'ru' || l === 'de' ? l : 'en';
}

export function currentLocale(): string {
  return LOCALES[currentLanguage()];
}

export default i18n;
