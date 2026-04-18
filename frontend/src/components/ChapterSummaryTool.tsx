import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';

interface ChapterSummaryToolProps {
  editorText: string;
}

export const ChapterSummaryTool: React.FC<ChapterSummaryToolProps> = ({ editorText }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true); setError(null); setSummary(null);
    try {
      const res = await apiClient.post('/summary/chapter', { chapterText: editorText });
      setSummary(res.summary);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du résumé.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3 p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
      <div>
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Résumé de Chapitre</h2>
        <p className="text-xs text-slate-400 mt-0.5">Fiche de documentation synthétique de votre chapitre.</p>
      </div>
      <button onClick={handleGenerate} disabled={loading} className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-amber-400 focus:outline-none">
        {loading ? 'Résumé en cours...' : 'Générer le résumé'}
      </button>
      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
      {summary && <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{summary}</div>}
    </div>
  );
};
