import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';

interface LexicalData {
  topFrequentWords: Record<string, number>;
  detectedForbiddenWords: string[];
  missingImposedWords: string[];
}

interface LexicalAnalysisToolProps {
  editorText: string;
}

export const LexicalAnalysisTool: React.FC<LexicalAnalysisToolProps> = ({ editorText }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LexicalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true); setError(null); setData(null);
    try {
      const response = await apiClient.post('/lexicon/analyze', { text: editorText });
      setData(response);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'analyse lexicale.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3 p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
      <div>
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contraintes Lexicales</h2>
        <p className="text-xs text-slate-400 mt-0.5">Tics de langage, mots surutilisés et respect du lexique de l'univers.</p>
      </div>
      <button onClick={handleAnalyze} disabled={loading} className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-amber-400 focus:outline-none">
        {loading ? 'Analyse en cours...' : 'Analyser le lexique'}
      </button>
      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
      {data && (
        <div className="flex flex-col space-y-3 p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm">
          <div>
            <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider mb-1.5">Mots fréquents</span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.topFrequentWords).map(([word, count]) => (
                <span key={word} className="bg-white text-amber-700 text-xs px-2 py-0.5 rounded border border-amber-200">
                  {word} ({count})
                </span>
              ))}
            </div>
          </div>
          {(data.detectedForbiddenWords.length > 0 || data.missingImposedWords.length > 0) && (
            <div className="pt-2 border-t border-amber-200/60 space-y-1.5">
              {data.detectedForbiddenWords.length > 0 && (
                <p className="text-red-700 text-xs"><span className="font-bold">Interdits détectés :</span> {data.detectedForbiddenWords.join(', ')}</p>
              )}
              {data.missingImposedWords.length > 0 && (
                <p className="text-orange-700 text-xs"><span className="font-bold">Lexique manquant :</span> {data.missingImposedWords.join(', ')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
