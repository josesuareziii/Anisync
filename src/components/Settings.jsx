import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const [crEmail, setCrEmail] = useState('');
  const [crPassword, setCrPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { token: authToken } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await fetch('http://localhost:4001/users/crunchyroll-creds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          email: crEmail,
          password: crPassword
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update credentials');
      }

      setMessage('Credentials updated successfully!');
      setCrPassword(''); // Clear password field for security
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>

      {message && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Crunchyroll Email
          </label>
          <input
            type="email"
            value={crEmail}
            onChange={(e) => setCrEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Crunchyroll Password
          </label>
          <input
            type="password"
            value={crPassword}
            onChange={(e) => setCrPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all"
        >
          Save Credentials
        </button>
      </form>
    </div>
  );
}