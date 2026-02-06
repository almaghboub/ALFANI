import { useState, useEffect } from "react";
import { Languages, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const { i18n, t } = useTranslation();
  const isMobile = useIsMobile();
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
    try {
      localStorage.setItem('i18nextLng', newLang);
    } catch (error) {
      console.warn('Failed to save language preference');
    }
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    const newDark = !isDark;
    if (newDark) {
      html.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
    setIsDark(newDark);
  };

  return (
    <header className="bg-card/80 glass-effect border-b border-border/50 px-4 sm:px-8 py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between">
        <div className={`${isMobile ? 'ltr:ml-12 rtl:mr-12' : ''}`}>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{title}</h2>
          {description && !isMobile && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground h-9 w-9 p-0 rounded-lg"
            data-testid="button-theme-toggle"
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="text-muted-foreground hover:text-foreground rounded-lg h-9 px-3 gap-1.5"
            data-testid="button-language-selector"
          >
            <Languages className="w-[18px] h-[18px]" />
            <span className="text-xs font-semibold">{i18n.language === 'en' ? 'AR' : 'EN'}</span>
          </Button>

          {!isMobile && (
            <div className="flex items-center gap-2 ltr:ml-2 rtl:mr-2 ltr:pl-2 rtl:pr-2 border-l rtl:border-l-0 rtl:border-r border-border/50">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground font-medium">{t('systemOnline')}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
