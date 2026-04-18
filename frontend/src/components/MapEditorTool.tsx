import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

interface MapEditorToolProps {
  onToast: (message: string, type?: 'success' | 'error') => void;
}

export const MapEditorTool: React.FC<MapEditorToolProps> = ({ onToast }) => {
  const [mapData, setMapData] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiClient.get('/map/data')
      .then(data => setMapData(JSON.stringify(data, null, 2)))
      .catch(() => setError('Erreur de chargement de la carte.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const parsed = JSON.parse(mapData);
      await apiClient.post('/map/data', parsed);
      onToast('Données géographiques sauvegardées.', 'success');
    } catch {
      setError('Format JSON invalide. Corrigez avant de sauvegarder.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3 p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
      <div>
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Éditeur de Carte</h2>
        <p className="text-xs text-slate-400 mt-0.5">Lieux et distances de votre univers (JSON structuré).</p>
      </div>
      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
      <textarea
        value={mapData}
        onChange={(e) => setMapData(e.target.value)}
        disabled={loading}
        className="w-full h-40 p-2 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-amber-400 outline-none resize-y"
      />
      <button
        onClick={handleSave}
        disabled={saving || loading}
        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none"
      >
        {saving ? 'Sauvegarde...' : 'Enregistrer la carte'}
      </button>
    </div>
  );
};
