import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const TIER_COLORS = {
  FREE: 'bg-gray-100 text-gray-800',
  PRO: 'bg-blue-100 text-blue-800',
  SUPPORTER: 'bg-purple-100 text-purple-800',
  LIFETIME: 'bg-green-100 text-green-800'
};

export default function AdminPanel() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:4001/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTierUpdate = async (userId, newTier) => {
    try {
      const response = await fetch(`http://localhost:4001/admin/users/${userId}/tier`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tier: newTier })
      });

      if (!response.ok) {
        throw new Error('Failed to update user tier');
      }

      // Refresh user list
      await fetchUsers();
      
      // Update selected user's data immediately
      if (selectedUser && selectedUser._id === userId) {
        const userResponse = await fetch(`http://localhost:4001/admin/users/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setSelectedUser(userData);
          
          // Trigger SSE refresh event for the affected user
          const eventSource = new EventSource(`http://localhost:4001/users/${userId}/notify-update`);
          eventSource.addEventListener('message', () => {
            eventSource.close();
          });
          eventSource.addEventListener('error', () => {
            eventSource.close();
          });
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAdminToggle = async (userId, isAdmin) => {
    try {
      const response = await fetch(`http://localhost:4001/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_admin: isAdmin })
      });

      if (!response.ok) {
        throw new Error('Failed to update admin status');
      }

      await fetchUsers();
      if (selectedUser && selectedUser._id === userId) {
        setSelectedUser(prev => ({ ...prev, is_admin: isAdmin }));
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="text-center p-4">Loading...</div>;
  if (error) return <div className="text-red-600 p-4">{error}</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Admin Panel</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* User List */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Users</h3>
          <div className="space-y-4">
            {users.map(user => (
              <div
                key={user._id}
                className="border p-4 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedUser(user)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{user.email}</p>
                    <p className="text-sm text-gray-500">
                      Created: {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${TIER_COLORS[user.tier || 'FREE']}`}>
                      {user.tier || 'FREE'}
                    </span>
                    {user.is_admin && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Details */}
        {selectedUser && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">User Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1">{selectedUser.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Current Tier</label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={selectedUser.tier || 'FREE'}
                  onChange={(e) => handleTierUpdate(selectedUser._id, e.target.value)}
                >
                  <option value="FREE">Free</option>
                  <option value="PRO">Pro</option>
                  <option value="SUPPORTER">Supporter</option>
                  <option value="LIFETIME">Lifetime Pro</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedUser.is_admin || false}
                    onChange={(e) => handleAdminToggle(selectedUser._id, e.target.checked)}
                  />
                  <span className="text-sm font-medium text-gray-700">Admin Privileges</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Features</label>
                <ul className="mt-1 list-disc list-inside text-sm text-gray-600">
                  {selectedUser.tier_info.features.map(feature => (
                    <li key={feature} className="capitalize">
                      {feature.replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Limits</label>
                <div className="mt-1 text-sm text-gray-600">
                  <p>Auto-syncs per day: {selectedUser.tier_info.auto_syncs_per_day === Infinity ? 'Unlimited' : selectedUser.tier_info.auto_syncs_per_day}</p>
                  <p>Sync history limit: {selectedUser.tier_info.sync_history_limit === Infinity ? 'Unlimited' : selectedUser.tier_info.sync_history_limit} entries</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}