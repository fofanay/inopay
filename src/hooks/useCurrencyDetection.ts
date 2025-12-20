import { useState, useEffect } from "react";

export type Currency = "CAD" | "USD" | "EUR";

// Mapping pays -> devise
const COUNTRY_CURRENCY_MAP: Record<string, Currency> = {
  // CAD
  CA: "CAD",
  // EUR
  FR: "EUR", DE: "EUR", IT: "EUR", ES: "EUR", PT: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", MT: "EUR", CY: "EUR",
  SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR",
  // USD par défaut pour le reste
};

export const useCurrencyDetection = () => {
  const [currency, setCurrency] = useState<Currency>("CAD");
  const [isLoading, setIsLoading] = useState(true);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);

  useEffect(() => {
    const detectCurrency = async () => {
      try {
        // Vérifier si une préférence est sauvegardée
        const savedCurrency = localStorage.getItem("preferred_currency") as Currency;
        if (savedCurrency && ["CAD", "USD", "EUR"].includes(savedCurrency)) {
          setCurrency(savedCurrency);
          setIsLoading(false);
          return;
        }

        // Détecter via API de géolocalisation
        const response = await fetch("https://ipapi.co/json/", {
          signal: AbortSignal.timeout(3000),
        });
        
        if (response.ok) {
          const data = await response.json();
          const countryCode = data.country_code;
          setDetectedCountry(countryCode);
          
          const detectedCurrency = COUNTRY_CURRENCY_MAP[countryCode] || "USD";
          setCurrency(detectedCurrency);
          localStorage.setItem("preferred_currency", detectedCurrency);
        }
      } catch (error) {
        console.log("Geolocation detection failed, using default CAD");
        setCurrency("CAD");
      } finally {
        setIsLoading(false);
      }
    };

    detectCurrency();
  }, []);

  const updateCurrency = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    localStorage.setItem("preferred_currency", newCurrency);
  };

  return { currency, setCurrency: updateCurrency, isLoading, detectedCountry };
};
