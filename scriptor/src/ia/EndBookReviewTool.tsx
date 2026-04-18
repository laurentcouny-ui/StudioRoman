import React, { useState } from 'react';
import { apiClient } from './apiClient';

interface EndBookReviewToolProps {
  editorText: string;
}

export const EndBookReviewTool: React.FC<EndBookReviewToolProps> = ({ editorText }) => {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [forgotten, setForgotten] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReview = async () => {
    setLoading(true); setError(null); setReview(null); setForgotten(null);
    try {
      const res = await apiClient.post('/analysis/review', { fullText: editorText });
      setReview(res.reviewQuestions);
      if (typeof res.forgottenCharacters === 'string' && res.forgottenCharacters.trim()) {
        setForgotten(res.forgottenCharacters.trim());
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors du bilan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-slate-800 shadow-sm text-white">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-yellow-400 uppercase tracking-wider">Bilan de Fin de Tome</h2>
        <p className="text-xs text-gray-300">Session rituelle. L'IA analyse l'intégralité de votre texte pour questionner vos arcs et incohérences.</p>
      </div>
      <button onClick={handleReview} disabled={loading} className="w-full py-2.5 px-4 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-700 text-slate-900 text-sm font-bold rounded-lg transition-colors focus:ring-2 focus:ring-yellow-400 focus:outline-none">
        {loading ? 'Analyse globale en cours...' : 'Lancer le Bilan'}
      </button>
      {error && <div className="p-3 bg-red-900/50 text-red-200 text-xs rounded-lg border border-red-800">{error}</div>}
      {review && (
        <div className="space-y-3">
          <div className="p-4 bg-slate-700 border border-slate-600 rounded-lg text-sm text-gray-100 whitespace-pre-wrap">
            {review}
          </div>
          {forgotten && (
            <div className="p-3 bg-amber-950/50 border border-amber-800 rounded-lg text-xs text-amber-100">
              <span className="font-semibold uppercase tracking-wide">Personnages absents (signal) :</span>{' '}
              {forgotten}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
