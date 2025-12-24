import { useTranslation } from "react-i18next";
import { useMemo } from "react";

/**
 * Hook for localized number and currency formatting
 * Uses Intl.NumberFormat for proper locale-aware formatting
 */
export function useLocaleFormat() {
  const { i18n } = useTranslation();
  
  const locale = useMemo(() => {
    return i18n.language === 'fr' ? 'fr-FR' : 'en-US';
  }, [i18n.language]);

  /**
   * Format a number with locale-specific separators
   * FR: 1 000,00 | EN: 1,000.00
   */
  const formatNumber = useMemo(() => {
    return (value: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        ...options
      }).format(value);
    };
  }, [locale]);

  /**
   * Format a currency value
   * FR: 1 000,00 € | EN: $1,000.00
   */
  const formatCurrency = useMemo(() => {
    return (value: number, currency: string = 'EUR') => {
      // Use CAD for French locale (Quebec), USD for English
      const currencyToUse = currency === 'auto' 
        ? (i18n.language === 'fr' ? 'CAD' : 'USD')
        : currency;
      
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyToUse,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(value);
    };
  }, [locale, i18n.language]);

  /**
   * Format a percentage
   * FR: 75 % | EN: 75%
   */
  const formatPercent = useMemo(() => {
    return (value: number, options?: Intl.NumberFormatOptions) => {
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
        ...options
      }).format(value / 100);
    };
  }, [locale]);

  /**
   * Format a compact number (1K, 1M, etc.)
   * FR: 1 k | EN: 1K
   */
  const formatCompact = useMemo(() => {
    return (value: number) => {
      return new Intl.NumberFormat(locale, {
        notation: 'compact',
        compactDisplay: 'short'
      }).format(value);
    };
  }, [locale]);

  /**
   * Format a date
   */
  const formatDate = useMemo(() => {
    return (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...options
      }).format(d);
    };
  }, [locale]);

  /**
   * Format a date with time
   */
  const formatDateTime = useMemo(() => {
    return (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        ...options
      }).format(d);
    };
  }, [locale]);

  return {
    locale,
    formatNumber,
    formatCurrency,
    formatPercent,
    formatCompact,
    formatDate,
    formatDateTime
  };
}
