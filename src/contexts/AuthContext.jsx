import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);
  const [processingAniList, setProcessingAniList] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [anilistToken, setAnilistToken] = useState(() => localStorage.getItem('anilist_token'));

  const validateAniListToken = useCallback(async (token) => {
    if (!token) return false;
    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `{ Viewer { id } }`
        })
      });
      return response.ok;
    } catch (err) {
      console.error('Failed to validate AniList token:', err);
      return false;
    }
  }, []);

  // Load and validate stored auth on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('user');
        const storedAnilistToken = localStorage.getItem('anilist_token');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));

          // Validate AniList token if it exists
          if (storedAnilistToken) {
            const isValid = await validateAniListToken(storedAnilistToken);
            if (!isValid) {
              localStorage.removeItem('anilist_token');
              setAnilistToken(null);
            } else {
              setAnilistToken(storedAnilistToken);
            }
          }
        }
      } catch (e) {
        console.error('Failed to initialize auth:', e);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [validateAniListToken]);

  // Handle AniList OAuth callback
  useEffect(() => {
    const handleAniListCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");
      const storedState = localStorage.getItem('anilist_auth_state');

      if (code && !processingAniList && token) {
        // Verify state parameter
        if (!state || state !== storedState) {
          setError('Invalid authentication state');
          return;
        }

        localStorage.removeItem('anilist_auth_state');
        setProcessingAniList(true);
        setAuthError(null);

        try {
          const response = await fetch('http://localhost:4001/auth/anilist', {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ code, state }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || data.details || "Failed to authenticate with AniList");
          }

          if (data.access_token) {
            const isValid = await validateAniListToken(data.access_token);
            if (!isValid) {
              throw new Error("Invalid token received from AniList");
            }

            localStorage.setItem("anilist_token", data.access_token);
            setAnilistToken(data.access_token);
            window.history.replaceState({}, document.title, window.location.pathname);

            // Refresh user data
            await refreshUser();
          } else {
            throw new Error("No access token received from AniList");
          }
        } catch (err) {
          console.error("AniList auth error:", err);
          setAuthError(err.message);
          localStorage.removeItem("anilist_token");
          setAnilistToken(null);
        } finally {
          setProcessingAniList(false);
        }
      }
    };

    handleAniListCallback();
  }, [token, processingAniList, validateAniListToken]);

  const refreshUser = useCallback(async () => {
    if (token) {
      try {
        const response = await fetch('http://localhost:4001/users/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const userData = await response.json();
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
          return true;
        } else if (response.status === 401) {
          logout();
        }
      } catch (err) {
        console.error('Failed to refresh user data:', err);
      }
      return false;
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      setAuthError(null);
      const response = await fetch('http://localhost:4001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);

      // Fetch full user data
      const userResponse = await fetch('http://localhost:4001/users/me', {
        headers: { 'Authorization': `Bearer ${data.token}` }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      }
    } catch (err) {
      console.error('Login error:', err);
      setAuthError(err.message);
      throw err;
    }
  };

  const register = async (email, password) => {
    try {
      setAuthError(null);
      const response = await fetch('http://localhost:4001/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error);
      }

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      console.error('Registration error:', err);
      setAuthError(err.message);
      throw err;
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('anilist_token');
    localStorage.removeItem('anilist_auth_state');
    setToken(null);
    setUser(null);
    setAuthError(null);
    setAnilistToken(null);
  }, []);

  const checkFeatureAccess = useCallback((feature) => {
    if (!user?.tier_info) return false;
    return user.tier_info.features.includes(feature);
  }, [user]);

  const getTierLimits = useCallback(() => {
    if (!user?.tier_info) return { auto_syncs_per_day: 10, sync_history_limit: 10 };
    return {
      auto_syncs_per_day: user.tier_info.auto_syncs_per_day === 'Infinity' ? Infinity : user.tier_info.auto_syncs_per_day,
      sync_history_limit: user.tier_info.sync_history_limit === 'Infinity' ? Infinity : user.tier_info.sync_history_limit
    };
  }, [user]);

  const value = useMemo(() => ({
    user,
    token,
    anilistToken,
    login,
    register,
    logout,
    loading,
    processingAniList,
    authError,
    refreshUser,
    checkFeatureAccess,
    getTierLimits,
    validateAniListToken
  }), [
    user,
    token,
    anilistToken,
    loading,
    processingAniList,
    authError,
    refreshUser,
    checkFeatureAccess,
    getTierLimits,
    validateAniListToken,
    logout
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}