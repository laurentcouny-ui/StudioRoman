import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';

interface EndBookReviewToolProps {
  editorText: string;
}

export const EndBookReviewTool: React.FC<EndBookReviewToolProps> = ({ editorText }) => {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReview = async () => {
    setLoading(true); setError(null); setReview(null);
    try {
      const res = await apiClient.post('/analysis/review', { fullText: editorText });
      setReview(res.reviewQuestions);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du bilan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3 p-4 border-2 border-amber-400 rounded-xl bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Bilan de Fin de Tome</h2>
          <p className="text-xs text-slate-400 mt-0.5">Session rituelle. L'IA interroge vos arcs et détecte les incohérences sur l'intégralité du texte.</p>
        </div>
        <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          Rituel
        </span>
      </div>
      <button
        onClick={handleReview}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-bold rounded-lg transition-colors focus:ring-2 focus:ring-amber-400 focus:outline-none"
      >
        {loading ? 'Analyse globale en cours...' : 'Lancer le Bilan'}
      </button>
      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
      {review && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{review}</div>
      )}
    </div>
  );
};
