import React from 'react';
import { useLanguage } from '../utils/i18n/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'am' : 'en');
  };

  return (
    <button
      onClick={toggleLanguage}
      className={`
        relative flex items-center gap-2 px-3 py-1.5 rounded-full 
        transition-all duration-300 group overflow-hidden
        ${language === 'am' 
          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
          : 'bg-white/10 text-white/70 border border-white/10 hover:border-white/30'}
      `}
      title={language === 'en' ? 'Switch to Amharic' : 'ወደ እንግሊዝኛ ቀይር'}
      id="language-toggle"
    >
      <div className="flex items-center gap-2 relative z-10">
        <span className={`text-xs font-bold ${language === 'en' ? 'text-white' : 'opacity-50'}`}>
          EN
        </span>
        <div className="w-px h-3 bg-white/20" />
        <span className={`text-sm tracking-tight ${language === 'am' ? 'text-white' : 'opacity-50'}`}>
          አማ
        </span>
      </div>
      
      {/* Subtle hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
    </button>
  );
}
