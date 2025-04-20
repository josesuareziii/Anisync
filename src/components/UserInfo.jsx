import { useAuth } from '../contexts/AuthContext';

const TIER_COLORS = {
  FREE: 'text-gray-600',
  PRO: 'text-blue-600',
  SUPPORTER: 'text-purple-600',
  LIFETIME: 'text-green-600'
};

export default function UserInfo({ user }) {
  const { logout } = useAuth();
  
  if (!user) return null;

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xl">
          {user.email[0].toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{user.email}</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Ready to sync your anime progress
            </span>
            <span className={`text-sm font-medium ${TIER_COLORS[user.tier || 'FREE']}`}>
              ({user.tier_info?.name || 'Free'} tier)
            </span>
          </div>
        </div>
      </div>
      <button 
        onClick={logout} 
        className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
      >
        Logout
      </button>
    </div>
  );
}