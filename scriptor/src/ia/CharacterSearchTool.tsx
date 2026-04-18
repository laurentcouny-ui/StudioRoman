import React, { useState } from 'react';
import { apiClient } from './apiClient';

export const CharacterSearchTool: React.FC = () => {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!keyword.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.get(
        `/characters/search?keyword=${encodeURIComponent(keyword)}`,
      );
      setResult(response.result);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la recherche dans les fiches personnages.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
          Personnages (Anti-Hallucination)
        </h2>
        <p className="text-xs text-gray-500">
          Interroge uniquement les fiches enregistrées. Chaque extrait est cité avec sa source.
        </p>
      </div>

      <div className="flex space-x-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Nom, rôle, mot dans la description…"
          className="flex-1 p-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading || !keyword.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          {loading ? '…' : 'Chercher'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>
      )}

      {result && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{result}</div>
        </div>
      )}
    </div>
  );
};
