import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePayPal } from '../contexts/PayPalContext';

export default function Plans() {
  const { user, token } = useAuth();
  const { paypal, loading: paypalLoading, error: paypalError } = usePayPal();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [donationAmount, setDonationAmount] = useState('5');
  const [error, setError] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Clear error when plan changes
  useEffect(() => {
    setError('');
  }, [selectedPlan]);

  const createOrder = async () => {
    try {
      setCreatingOrder(true);
      setError('');
      const response = await fetch('http://localhost:4001/subscription/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plan: selectedPlan,
          amount: selectedPlan === 'SUPPORTER' ? donationAmount : undefined
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create payment');
      }

      const data = await response.json();
      // Add plan parameter to approval URL
      const url = new URL(data.approval_url);
      url.searchParams.append('plan', selectedPlan);
      window.location.href = url.toString();
    } catch (err) {
      console.error('Payment creation error:', err);
      setError(err.message);
    } finally {
      setCreatingOrder(false);
    }
  };

  if (user?.tier === 'LIFETIME') {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-lg text-center">
        <h2 className="text-2xl font-bold text-indigo-800">🌟 Lifetime Pro Member</h2>
        <p className="text-indigo-600 mt-2">You have access to all premium features forever!</p>
      </div>
    );
  }

  if (paypalLoading) {
    return <div className="text-center py-8">Loading payment options...</div>;
  }

  if (paypalError) {
    return (
      <div className="text-center py-8 text-red-600">
        Failed to load payment options: {paypalError}
      </div>
    );
  }

  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold text-center mb-8">Choose Your Plan</h2>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Free Tier */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-xl font-semibold">Free Tier</h3>
          <p className="text-gray-500 mt-2">For Everyone</p>
          <div className="mt-4 text-3xl font-bold">$0</div>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Basic features
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              10 auto-syncs/day
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Last 10 sync entries
            </li>
          </ul>
        </div>

        {/* Pro Monthly/Yearly */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg shadow-md border border-blue-200 relative">
          <div className="absolute -top-3 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
            Popular
          </div>
          <h3 className="text-xl font-semibold">Pro</h3>
          <p className="text-gray-500 mt-2">For Daily Watchers</p>
          <div className="mt-4">
            <div className="text-3xl font-bold">$3<span className="text-lg">/mo</span></div>
            <div className="text-sm text-gray-500">or $30/year</div>
          </div>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-center">
              <span className="text-blue-500 mr-2">✓</span>
              Unlimited auto-syncs
            </li>
            <li className="flex items-center">
              <span className="text-blue-500 mr-2">✓</span>
              Full sync history
            </li>
            <li className="flex items-center">
              <span className="text-blue-500 mr-2">✓</span>
              Multiple devices
            </li>
          </ul>
          <div className="mt-6 space-y-2">
            {selectedPlan?.startsWith('PRO_') ? (
              <button
                onClick={createOrder}
                disabled={creatingOrder}
                className={`w-full py-2 text-white rounded-lg transition-colors ${
                  creatingOrder 
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {creatingOrder ? 'Processing...' : 'Continue to PayPal'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setSelectedPlan('PRO_MONTHLY')}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Monthly ($3/mo)
                </button>
                <button
                  onClick={() => setSelectedPlan('PRO_YEARLY')}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Yearly ($30/yr)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Lifetime */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-lg shadow-md border border-purple-200">
          <h3 className="text-xl font-semibold">Lifetime</h3>
          <p className="text-gray-500 mt-2">One-time Purchase</p>
          <div className="mt-4 text-3xl font-bold">$35</div>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-center">
              <span className="text-purple-500 mr-2">✓</span>
              All Pro features forever
            </li>
            <li className="flex items-center">
              <span className="text-purple-500 mr-2">✓</span>
              Founder badge
            </li>
            <li className="flex items-center">
              <span className="text-purple-500 mr-2">✓</span>
              Priority support
            </li>
          </ul>
          {selectedPlan === 'LIFETIME' ? (
            <button
              onClick={createOrder}
              disabled={creatingOrder}
              className={`w-full mt-6 py-2 text-white rounded-lg transition-colors ${
                creatingOrder 
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {creatingOrder ? 'Processing...' : 'Continue to PayPal'}
            </button>
          ) : (
            <button
              onClick={() => setSelectedPlan('LIFETIME')}
              className="w-full mt-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Get Lifetime Access
            </button>
          )}
        </div>

        {/* Supporter */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg shadow-md border border-green-200">
          <h3 className="text-xl font-semibold">Supporter</h3>
          <p className="text-gray-500 mt-2">Pay What You Want</p>
          <div className="mt-4">
            <div className="relative">
              <span className="absolute left-3 top-2 text-lg">$</span>
              <input
                type="number"
                min="1"
                value={donationAmount}
                onChange={(e) => setDonationAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border rounded-lg"
              />
            </div>
            <div className="text-sm text-gray-500 mt-1">per month</div>
          </div>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Supporter badge
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Discord perks
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Support development
            </li>
          </ul>
          {selectedPlan === 'SUPPORTER' ? (
            <button
              onClick={createOrder}
              disabled={creatingOrder}
              className={`w-full mt-6 py-2 text-white rounded-lg transition-colors ${
                creatingOrder 
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {creatingOrder ? 'Processing...' : 'Continue to PayPal'}
            </button>
          ) : (
            <button
              onClick={() => setSelectedPlan('SUPPORTER')}
              className="w-full mt-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Become a Supporter
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 text-center text-red-600 text-sm">
          {error}
        </div>
      )}

      {selectedPlan && (
        <div className="text-center mt-4">
          <button
            onClick={() => setSelectedPlan(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}