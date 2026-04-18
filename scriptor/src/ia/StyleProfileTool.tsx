import React, { useState, useEffect } from 'react';
import { apiClient } from './apiClient';

interface StyleProfile {
  extraits: string[];
  /** Rapport d'analyse renvoyé par le backend (alias historique : analyseIa). */
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
      setError(err.message || "Erreur lors du chargement du profil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

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
    const updatedExtraits = profile.extraits.filter((_, i) => i !== index);
    const updatedProfile = { ...profile, extraits: updatedExtraits };
    
    setLoading(true);
    try {
      const data = await apiClient.post('/style', updatedProfile);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la suppression.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
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
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Profil de Ton Narratif</h2>
        <p className="text-xs text-gray-500">
          Stockez 3 à 5 de vos meilleurs extraits. L'IA les analysera pour s'aligner sur votre voix.
        </p>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}

      <div className="space-y-2">
        {profile?.extraits.map((extrait, idx) => (
          <div key={idx} className="flex items-start justify-between p-2 bg-rose-50 border border-rose-100 rounded text-xs text-gray-700">
            <span className="line-clamp-2 flex-1 italic">"{extrait}"</span>
            <button onClick={() => handleRemoveExtract(idx)} disabled={loading} className="ml-2 text-rose-500 hover:text-rose-700 font-bold">✕</button>
          </div>
        ))}
      </div>

      <div className="flex flex-col space-y-2">
        <textarea value={newExtract} onChange={(e) => setNewExtract(e.target.value)} placeholder="Collez un extrait représentatif de votre plume ici..." className="w-full p-2 text-xs border border-gray-300 rounded-md bg-gray-50 resize-none h-16 focus:ring-2 focus:ring-rose-500 outline-none" />
        <button onClick={handleAddExtract} disabled={loading || !newExtract.trim()} className="self-end px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded transition-colors disabled:opacity-50">Ajouter l'extrait</button>
      </div>

      <button onClick={handleAnalyze} disabled={analyzing || !profile || profile.extraits.length === 0} className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-rose-500 focus:outline-none">
        {analyzing ? 'Analyse en cours...' : 'Générer mon profil stylistique'}
      </button>

      {(profile?.analysisReport ?? profile?.analyseIa) && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-wider">Synthèse IA :</p>
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {profile?.analysisReport ?? profile?.analyseIa}
          </div>
        </div>
      )}
    </div>
  );
};
