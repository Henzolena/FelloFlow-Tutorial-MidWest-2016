import React, { createContext, useContext, useState, useEffect } from 'react';
import TRANSLATIONS from '../../data/i18n/am';
import EN_TRANSLATIONS from '../../data/i18n/en';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');

  // Load Noto Sans Ethiopic if language is Amharic
  useEffect(() => {
    if (language === 'am') {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@100..900&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      document.body.style.fontFamily = '"Noto Sans Ethiopic", "Inter", sans-serif';
    } else {
      document.body.style.fontFamily = '"Inter", sans-serif';
    }
  }, [language]);

  const t = (key) => {
    const bundle = language === 'am' ? TRANSLATIONS : EN_TRANSLATIONS;
    
    // Support nested keys like 'ui.next'
    const keys = key.split('.');
    let value = bundle;
    
    for (const k of keys) {
      if (value && value[k]) {
        value = value[k];
      } else {
        return key; // Fallback to key if not found
      }
    }
    
    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
