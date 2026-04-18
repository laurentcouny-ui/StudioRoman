import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';
import { Tone } from './ToneSelector';

interface BlankPageToolProps {
  editorText: string;
  tone: Tone;
}

export const BlankPageTool: React.FC<BlankPageToolProps> = ({ editorText, tone }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDiagnose = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.post('/page-blanche/diagnose', {
        fullText: editorText,
        cursorPosition: editorText.length,
        tone,
      });
      setResult(response.questions);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors du diagnostic.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3 p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
      <div>
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Page Blanche</h2>
        <p className="text-xs text-slate-400 mt-0.5">Bloqué ? L'IA analyse les dernières lignes et vous relance.</p>
      </div>

      <button
        onClick={handleDiagnose}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-amber-400 focus:outline-none"
      >
        {loading ? 'Analyse en cours...' : 'Débloquer la scène'}
      </button>

      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}

      {result && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
          <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{result}</div>
        </div>
      )}
    </div>
  );
};
