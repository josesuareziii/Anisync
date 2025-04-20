import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import Header from "./components/Header";
import ErrorAlert from "./components/ErrorAlert";
import UserInfo from "./components/UserInfo";
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";
import ManualSync from "./components/ManualSync";
import Settings from "./components/Settings";
import Plans from "./components/Plans";
import PaymentSuccess from "./components/PaymentSuccess";
import PaymentCancel from "./components/PaymentCancel";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PayPalProvider } from './contexts/PayPalContext';

const CLIENT_ID = "25863";
const REDIRECT_URI = "http://localhost:5173";
const PUPPETEER_SERVICE = "http://localhost:4000";
const BACKEND_SERVICE = "http://localhost:4001";

function Dashboard() {
  const { token: authToken, user, checkFeatureAccess, getTierLimits, anilistToken, validateAniListToken, refreshUser } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [isSyncInProgress, setIsSyncInProgress] = useState(false);
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem('auto_sync_enabled') === 'true');
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [syncStats, setSyncStats] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [syncCount, setSyncCount] = useState(() => {
    const stored = localStorage.getItem('sync_count');
    const lastSyncDate = localStorage.getItem('last_sync_date');
    const today = new Date().toDateString();
    
    if (stored && lastSyncDate === today) {
      return parseInt(stored, 10);
    }
    
    localStorage.setItem('last_sync_date', today);
    localStorage.setItem('sync_count', '0');
    return 0;
  });

  const { auto_syncs_per_day, sync_history_limit } = getTierLimits();

  // Listen for user updates with reconnection logic
  useEffect(() => {
    if (!user?._id || !authToken) return;

    let eventSource;
    let retryTimeout;

    const connectSSE = () => {
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource(`http://localhost:4001/users/${user._id}/notify-update`);
      
      eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'refresh') {
            await refreshUser();
            await fetchLogs();  // Refresh logs when user data updates
          }
        } catch (err) {
          console.error('Error processing SSE message:', err);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        if (retryCount < maxRetries) {
          retryTimeout = setTimeout(() => {
            setRetryCount(prev => prev + 1);
            connectSSE();
          }, 1000 * (retryCount + 1));  // Exponential backoff
        }
      };

      eventSource.onopen = () => {
        setRetryCount(0);  // Reset retry count on successful connection
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [user?._id, authToken, refreshUser, retryCount]);

  // Update sync count in localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sync_count', syncCount.toString());
  }, [syncCount]);

  // Persist autoSync state
  useEffect(() => {
    localStorage.setItem('auto_sync_enabled', autoSync);
  }, [autoSync]);

  // Handle auto-sync interval
  useEffect(() => {
    let interval;
    if (autoSync && anilistToken && !isSyncInProgress && checkFeatureAccess('unlimited_auto_sync')) {
      interval = setInterval(handleSync, 5 * 60 * 1000); // 5 minutes
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoSync, anilistToken, isSyncInProgress]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const storedState = localStorage.getItem('anilist_auth_state');

    if (code) {
      if (!state || state !== storedState) {
        setError('Invalid authentication state');
        return;
      }

      localStorage.removeItem('anilist_auth_state');

      const authRequestKey = `auth_request_${code}`;
      if (localStorage.getItem(authRequestKey)) {
        return;
      }
      localStorage.setItem(authRequestKey, Date.now().toString());

      setError(null);
      
      const attemptAuth = async () => {
        try {
          const res = await fetch(`${BACKEND_SERVICE}/auth/anilist`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ code }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || data.details || "Failed to authenticate with AniList");
          }

          if (data.access_token) {
            localStorage.setItem("anilist_token", data.access_token);
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            throw new Error("No access token received from AniList");
          }
        } catch (err) {
          console.error("AniList auth error:", err);
          setError(err.message || "Failed to authenticate with AniList");
          localStorage.removeItem("anilist_token");
        } finally {
          localStorage.removeItem(authRequestKey);
        }
      };

      attemptAuth();
    }
  }, [authToken]);

  const loginAniList = () => {
    const state = Math.random().toString(36).substring(2);
    localStorage.setItem('anilist_auth_state', state);
    const url = `https://anilist.co/api/v2/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&state=${state}`;
    window.location.href = url;
  };

  const handleSync = async () => {
    if (syncCount >= auto_syncs_per_day) {
      setError(`You've reached your daily sync limit (${auto_syncs_per_day}). Upgrade to Pro for unlimited syncs.`);
      return;
    }

    if (isSyncInProgress) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    if (!anilistToken) {
      setError('Please login to AniList first');
      return;
    }
  
    setSyncing(true);
    setIsSyncInProgress(true);
    setError(null);
  
    const maxRetries = 3;
    let attempt = 0;
  
    while (attempt < maxRetries) {
      try {
        attempt++;
        if (attempt > 1) {
          console.log(`Retry attempt ${attempt}/${maxRetries}`);
        }
  
        const historyRes = await fetch(`${PUPPETEER_SERVICE}/scrape`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
  
        if (!historyRes.ok) {
          const errorData = await historyRes.json();
          if (historyRes.status === 401) {
            throw new Error("Please login to Crunchyroll first");
          }
          if (errorData.details?.includes('Cloudflare') || errorData.error?.includes('Cloudflare')) {
            if (attempt < maxRetries) {
              setError(`Cloudflare verification required. Retrying... (Attempt ${attempt}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 5000));
              continue;
            }
            throw new Error("Failed to bypass Cloudflare verification after multiple attempts");
          }
          throw new Error(errorData.error || "Failed to fetch watch history");
        }
  
        const history = await historyRes.json();
        if (!history.data || !Array.isArray(history.data)) {
          throw new Error("Invalid history data format");
        }
  
        const res = await fetch(`${BACKEND_SERVICE}/sync`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`
          },
          body: JSON.stringify({ 
            token: anilistToken,
            history: history.data
          }),
        });
  
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.details || "Sync request failed");
        }
  
        setSyncStats({
          count: data.result?.length || 0,
          time: new Date().toLocaleTimeString(),
        });
        setSyncCount(prev => prev + 1);
  
        await fetchLogs();
        break;
  
      } catch (err) {
        console.error("Sync error:", err);
        if (attempt === maxRetries) {
          setError(err.message);
        }
      }
    }
    setSyncing(false);
    setIsSyncInProgress(false);
  };

  const fetchLogs = async () => {
    let attempts = 0;
    const maxAttempts = 3;
    const backoffDelay = 1000;

    while (attempts < maxAttempts) {
      try {
        const res = await fetch(`${BACKEND_SERVICE}/logs`, {
          headers: {
            "Authorization": `Bearer ${authToken}`
          }
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          if (errorData.error === "Token has expired") {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.reload();
            return;
          }
          throw new Error(errorData.error || `Server error: ${res.status}`);
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          throw new Error("Invalid response format");
        }

        setLogs(data.slice(0, sync_history_limit).reverse());
        setError(null);
        return;

      } catch (err) {
        attempts++;
        console.error(`Fetch logs attempt ${attempts} failed:`, err);
        
        if (attempts === maxAttempts) {
          setError("Could not fetch sync history. Please try again later.");
          setLogs([]);
        } else {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, backoffDelay * Math.pow(2, attempts - 1))
          );
        }
      }
    }
  };

  useEffect(() => {
    if (authToken) fetchLogs();
  }, [authToken]);

  useEffect(() => {
    const now = new Date();
    const night = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0
    );
    const msToMidnight = night.getTime() - now.getTime();

    const timer = setTimeout(() => {
      setSyncCount(0);
    }, msToMidnight);

    return () => clearTimeout(timer);
  }, []);

  const handleManualSync = (syncResult) => {
    fetchLogs();
    setSyncStats({
      count: 1,
      time: new Date().toLocaleTimeString(),
    });
    setSyncCount(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6">
      <Header />
      <ErrorAlert error={error} />

      {user?.is_admin && (
        <div className="mb-4 text-center space-x-4">
          <Link 
            to="/dashboard" 
            className="inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Go to Admin Dashboard
          </Link>
          <Link 
            to="/settings" 
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Settings
          </Link>
        </div>
      )}

      {!anilistToken ? (
        <div className="flex justify-center">
          <button
            onClick={loginAniList}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold"
          >
            Login with AniList
          </button>
        </div>
      ) : (
        <>
          <div className="max-w-4xl mx-auto mb-6">
            <Plans />
          </div>
          <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
            <UserInfo user={user} />
            <ManualSync onSync={handleManualSync} />
            
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className={`px-4 py-2 font-medium rounded ${
                    syncing ? "bg-gray-300 cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {syncing ? "Syncing..." : "Manual Sync"}
                </button>
                
                <div className="text-sm text-gray-600">
                  {syncCount}/{auto_syncs_per_day} syncs today
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={() => setAutoSync(!autoSync)}
                  className="h-4 w-4"
                  disabled={!checkFeatureAccess('unlimited_auto_sync') && syncCount >= auto_syncs_per_day}
                />
                Auto Sync (every 5 min)
                {!checkFeatureAccess('unlimited_auto_sync') && (
                  <span className="text-xs text-blue-600">
                    (Pro feature)
                  </span>
                )}
              </label>
            </div>

            {syncStats && (
              <div className="mb-4 bg-blue-50 p-3 rounded text-center text-sm">
                Last sync: {syncStats.count} items at {syncStats.time}
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">📝 Sync Log</h2>
              {!checkFeatureAccess('full_history') && (
                <span className="text-xs text-gray-500">
                  Showing last {sync_history_limit} entries (Upgrade to Pro for full history)
                </span>
              )}
            </div>
            
            {logs.length === 0 ? (
              <p className="text-gray-500">No sync history yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="border p-3 rounded hover:bg-gray-50 flex justify-between">
                    <div>
                      <h3 className="font-medium">{log.title}</h3>
                      <p className="text-sm text-gray-600">
                        {log.episode} • Synced to Ep {log.progress}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs px-2 py-1 rounded font-semibold ${
                          log.status === "CURRENT"
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {log.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{log.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/payment-success" 
        element={
          <ProtectedRoute>
            <PaymentSuccess />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/payment-cancel" 
        element={
          <ProtectedRoute>
            <PaymentCancel />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PayPalProvider>
        <Router>
          <AppContent />
        </Router>
      </PayPalProvider>
    </AuthProvider>
  );
}