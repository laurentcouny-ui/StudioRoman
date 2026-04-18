import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';

interface ForgottenCharacterToolProps {
  editorText: string;
}

export const ForgottenCharacterTool: React.FC<ForgottenCharacterToolProps> = ({ editorText }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDetect = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await apiClient.post('/characters/forgotten', { recentText: editorText });
      setResult(res.forgottenCharacters);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'analyse.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3 p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
      <div>
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Personnages Oubliés</h2>
        <p className="text-xs text-slate-400 mt-0.5">Personnages de votre univers absents du texte récent.</p>
      </div>
      <button onClick={handleDetect} disabled={loading} className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-amber-400 focus:outline-none">
        {loading ? 'Recherche en cours...' : 'Détecter les absents'}
      </button>
      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
      {result && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-slate-800">
          <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider block mb-1">Absents détectés</span>
          {result}
        </div>
      )}
    </div>
  );
};
