import { createContext, useContext, useEffect, useState } from 'react';
import { loadScript } from "@paypal/paypal-js";

const PayPalContext = createContext(null);

export function usePayPal() {
  const context = useContext(PayPalContext);
  if (!context) {
    throw new Error('usePayPal must be used within a PayPalProvider');
  }
  return context;
}

export function PayPalProvider({ children }) {
  const [paypal, setPaypal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadPayPal = async () => {
      try {
        setLoading(true);
        setError(null);
        const paypalInstance = await loadScript({
          "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID,
          currency: "USD",
          intent: "capture",
          components: "buttons"
        });

        if (isMounted) {
          setPaypal(paypalInstance);
          setLoading(false);
        }
      } catch (err) {
        console.error('PayPal initialization failed:', err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadPayPal();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <PayPalContext.Provider value={{ paypal, loading, error }}>
      {children}
    </PayPalContext.Provider>
  );
}