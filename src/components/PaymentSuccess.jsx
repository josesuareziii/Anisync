import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, refreshUser } = useAuth();
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    let redirectTimer;
    
    const executePayment = async () => {
      try {
        setIsProcessing(true);
        const paymentId = searchParams.get('paymentId');
        const paymentToken = searchParams.get('token');
        const payerId = searchParams.get('PayerID');
        const plan = searchParams.get('plan');

        if ((!paymentId && !paymentToken) || !payerId || !plan) {
          throw new Error('Missing payment parameters');
        }

        const response = await fetch('http://localhost:4001/subscription/execute-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            paymentId,
            paymentToken,
            payerId,
            plan
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Payment execution failed');
        }

        // Refresh user data to get updated tier
        await refreshUser();
        
        // Set success state
        setIsProcessing(false);
        
        // Redirect to dashboard after successful payment
        redirectTimer = setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);

      } catch (err) {
        console.error('Payment execution error:', err);
        setError(err.message);
        setIsProcessing(false);
      }
    };

    executePayment();

    // Cleanup timeout on unmount or error
    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [searchParams, token, navigate, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        {error ? (
          <>
            <div className="text-red-600 text-xl mb-4">❌ Payment Failed</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </>
        ) : (
          <>
            <div className="text-green-600 text-xl mb-4">
              {isProcessing ? '⏳ Processing Payment...' : '✅ Payment Successful!'}
            </div>
            <p className="text-gray-600 mb-4">
              {isProcessing 
                ? 'Please wait while we process your payment...'
                : 'Thank you for your purchase. Your account has been upgraded.'}
            </p>
            {!isProcessing && (
              <p className="text-sm text-gray-500">
                Redirecting to dashboard in 3 seconds...
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}