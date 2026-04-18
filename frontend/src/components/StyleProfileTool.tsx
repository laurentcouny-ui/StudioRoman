import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

interface StyleProfile {
  extraits: string[];
  analysisReport?: string;
  analyseIa?: string;
}

export const StyleProfileTool: React.FC = () => {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newExtract, setNewExtract] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/style');
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du profil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleAddExtract = async () => {
    if (!newExtract.trim() || !profile) return;
    const updatedProfile = { ...profile, extraits: [...profile.extraits, newExtract] };
    setLoading(true);
    try {
      const data = await apiClient.post('/style', updatedProfile);
      setProfile(data);
      setNewExtract('');
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'ajout de l'extrait.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveExtract = async (index: number) => {
    if (!profile) return;
    const updatedProfile = { ...profile, extraits: profile.extraits.filter((_, i) => i !== index) };
    setLoading(true);
    try {
      const data = await apiClient.post('/style', updatedProfile);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true); setError(null);
    try {
      const data = await apiClient.post('/style/analyze', {});
      setProfile(data);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'analyse du style.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3 p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
      <div>
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Profil de Ton Narratif</h2>
        <p className="text-xs text-slate-400 mt-0.5">3 à 5 extraits représentatifs. L'IA s'aligne sur votre voix.</p>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}

      <div className="space-y-1.5">
        {profile?.extraits.map((extrait, idx) => (
          <div key={idx} className="flex items-start justify-between p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-xs text-slate-700">
            <span className="line-clamp-2 flex-1 italic">"{extrait}"</span>
            <button onClick={() => handleRemoveExtract(idx)} disabled={loading} className="ml-2 text-slate-400 hover:text-red-500 transition-colors font-bold flex-shrink-0">✕</button>
          </div>
        ))}
      </div>

      <div className="flex flex-col space-y-1.5">
        <textarea
          value={newExtract}
          onChange={(e) => setNewExtract(e.target.value)}
          placeholder="Collez un extrait représentatif de votre plume…"
          className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 resize-none h-16 focus:ring-2 focus:ring-amber-400 outline-none"
        />
        <button
          onClick={handleAddExtract}
          disabled={loading || !newExtract.trim()}
          className="self-end px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          Ajouter l'extrait
        </button>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={analyzing || !profile || profile.extraits.length === 0}
        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-amber-400 focus:outline-none"
      >
        {analyzing ? 'Analyse en cours...' : 'Générer mon profil stylistique'}
      </button>

      {(profile?.analysisReport ?? profile?.analyseIa) && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
          <p className="text-[10px] text-slate-500 font-bold mb-1.5 uppercase tracking-wider">Synthèse IA</p>
          <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {profile?.analysisReport ?? profile?.analyseIa}
          </div>
        </div>
      )}
    </div>
  );
};
