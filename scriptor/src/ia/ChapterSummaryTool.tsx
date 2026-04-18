import React, { useState } from 'react';
import { apiClient } from './apiClient';

interface ChapterSummaryToolProps {
  editorText: string;
}

export const ChapterSummaryTool: React.FC<ChapterSummaryToolProps> = ({ editorText }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [proposeNotice, setProposeNotice] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true); setError(null); setSummary(null);
    try {
      const res = await apiClient.post('/summary/chapter', { chapterText: editorText });
      setSummary(res.summary);
    } catch (err: any) {
      setError(err.message || "Erreur lors du résumé.");
    } finally {
      setLoading(false);
    }
  };

  const handleProposeToBible = async () => {
    if (!summary?.trim()) return;
    setProposing(true);
    setProposeNotice(null);
    try {
      await apiClient.post('/bible/propose-entry', {
        contenu: summary,
        section: 'Résumé de chapitre (proposition)',
      });
      setProposeNotice(
        'Proposition enregistrée dans la fiche dédiée de la bible (validation auteur manuelle).',
      );
    } catch (err: any) {
      setProposeNotice(err?.message || "Impossible d'enregistrer la proposition.");
    } finally {
      setProposing(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Résumé de Chapitre</h2>
        <p className="text-xs text-gray-500">Générez une fiche de documentation synthétique de votre chapitre.</p>
      </div>
      <button onClick={handleGenerate} disabled={loading} className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-sky-500 focus:outline-none">
        {loading ? 'Résumé en cours...' : 'Générer le résumé'}
      </button>
      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
      {summary && (
        <div className="space-y-2">
          <div className="p-4 bg-sky-50 border border-sky-100 rounded-lg text-sm text-gray-800 whitespace-pre-wrap">{summary}</div>
          <button
            type="button"
            onClick={handleProposeToBible}
            disabled={proposing}
            className="w-full py-2 px-3 bg-white border border-sky-400 text-sky-800 text-xs font-semibold rounded-lg hover:bg-sky-50 disabled:opacity-50"
          >
            {proposing ? 'Enregistrement…' : 'Proposer ce résumé pour la bible (fiche dédiée)'}
          </button>
          {proposeNotice && <p className="text-[10px] text-sky-900/80">{proposeNotice}</p>}
        </div>
      )}
    </div>
  );
};
