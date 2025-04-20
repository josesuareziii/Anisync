import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ManualSync({ onSync }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [episode, setEpisode] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { token: authToken } = useAuth();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    try {
      const anilistToken = localStorage.getItem('anilist_token');
      const response = await fetch(`http://localhost:4001/search/anime?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Anilist-Token': anilistToken
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setSearchResults(data.Media ? [data.Media] : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnimeSelect = (anime) => {
    setSelectedAnime(anime);
    setEpisode(1);
  };

  const handleSync = async () => {
    if (!selectedAnime) return;

    setLoading(true);
    setError('');

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        attempt++;
        if (attempt > 1) {
          setError(`Retrying... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
        }

        const anilistToken = localStorage.getItem('anilist_token');
        const response = await fetch('http://localhost:4001/sync/manual', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: anilistToken,
            mediaId: selectedAnime.id,
            title: selectedAnime.title.romaji,
            episode: parseInt(episode)
          })
        });

        const data = await response.json();
        if (!response.ok) {
          // Check for Cloudflare-related errors
          if (data.details?.includes('Cloudflare') || data.error?.includes('Cloudflare')) {
            if (attempt < maxRetries) {
              continue;
            }
            throw new Error("Failed to bypass Cloudflare verification after multiple attempts");
          }
          throw new Error(data.error || data.details || 'Sync failed');
        }

        // Reset form
        setSelectedAnime(null);
        setSearchQuery('');
        setSearchResults(null);
        setEpisode(1);
        
        // Notify parent component
        if (onSync) onSync(data.result);
        break; // Success, exit retry loop

      } catch (err) {
        console.error('Sync error:', err);
        if (attempt === maxRetries) {
          setError(err.message);
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-xl font-semibold mb-4">Manual Sync</h2>
      
      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anime..."
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-medium ${
              loading
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Search
          </button>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="mb-4 text-red-600 text-sm">{error}</div>
      )}

      {/* Search Results */}
      {searchResults && searchResults.length > 0 && !selectedAnime && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">Search Results:</h3>
          <div className="space-y-2">
            {searchResults.map(anime => (
              <div
                key={anime.id}
                onClick={() => handleAnimeSelect(anime)}
                className="flex items-center gap-4 p-2 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                {anime.coverImage?.medium && (
                  <img
                    src={anime.coverImage.medium}
                    alt={anime.title.romaji}
                    className="w-16 h-24 object-cover rounded"
                  />
                )}
                <div>
                  <h4 className="font-medium">{anime.title.romaji}</h4>
                  <p className="text-sm text-gray-600">
                    {anime.episodes ? `${anime.episodes} episodes` : 'Episodes unknown'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Episode Selection */}
      {selectedAnime && (
        <div className="mb-4">
          <div className="flex items-center gap-4 mb-4">
            {selectedAnime.coverImage?.medium && (
              <img
                src={selectedAnime.coverImage.medium}
                alt={selectedAnime.title.romaji}
                className="w-16 h-24 object-cover rounded"
              />
            )}
            <div>
              <h3 className="font-medium">{selectedAnime.title.romaji}</h3>
              <p className="text-sm text-gray-600">
                {selectedAnime.episodes ? `${selectedAnime.episodes} episodes` : 'Episodes unknown'}
              </p>
            </div>
            <button
              onClick={() => setSelectedAnime(null)}
              className="ml-auto text-sm text-gray-500 hover:text-gray-700"
            >
              Change Anime
            </button>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Episode Number
              </label>
              <input
                type="number"
                min="1"
                max={selectedAnime.episodes || 999}
                value={episode}
                onChange={(e) => setEpisode(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleSync}
              disabled={loading}
              className={`px-6 py-2 rounded-lg font-medium ${
                loading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              Sync
            </button>
          </div>
        </div>
      )}
    </div>
  );
}