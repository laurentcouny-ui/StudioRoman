import React, { useState } from 'react';
import { apiClient } from './apiClient';

interface ForgottenCharacterToolProps {
  editorText: string;
}

export const ForgottenCharacterTool: React.FC<ForgottenCharacterToolProps> = ({ editorText }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scopeHint, setScopeHint] = useState('');

  const handleDetect = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await apiClient.post('/characters/forgotten', {
        recentText: editorText,
        scopeHint: scopeHint.trim() || undefined,
      });
      setResult(res.forgottenCharacters);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'analyse.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Personnages Oubliés</h2>
        <p className="text-xs text-gray-500">Vérifiez quels personnages de votre univers n'apparaissent pas dans le texte récent.</p>
      </div>
      <input
        type="text"
        value={scopeHint}
        onChange={(e) => setScopeHint(e.target.value)}
        placeholder="Périmètre (ex. derniers 3 chapitres) — optionnel"
        className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-xs focus:ring-2 focus:ring-fuchsia-500 outline-none"
      />
      <button onClick={handleDetect} disabled={loading} className="w-full py-2.5 px-4 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-fuchsia-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-fuchsia-500 focus:outline-none">
        {loading ? 'Recherche en cours...' : 'Détecter les absents'}
      </button>
      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
      {result && <div className="p-4 bg-fuchsia-50 border border-fuchsia-100 rounded-lg text-sm text-gray-800 font-medium">Absents détectés : {result}</div>}
    </div>
  );
};
