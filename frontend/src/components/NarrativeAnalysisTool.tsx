import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';

interface NarrativeAnalysisToolProps {
  editorText: string;
}

export const NarrativeAnalysisTool: React.FC<NarrativeAnalysisToolProps> = ({ editorText }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true); setError(null); setReport(null);
    try {
      const response = await apiClient.post('/analysis/narrative', { text: editorText });
      setReport(response.analysisReport);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'analyse narrative.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3 p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
      <div>
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rythme Narratif</h2>
        <p className="text-xs text-slate-400 mt-0.5">Courbe d'action, longueur des scènes, changements de POV.</p>
      </div>
      <button onClick={handleAnalyze} disabled={loading} className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-amber-400 focus:outline-none">
        {loading ? 'Analyse en cours...' : 'Analyser le rythme'}
      </button>
      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
      {report && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{report}</div>
      )}
    </div>
  );
};
