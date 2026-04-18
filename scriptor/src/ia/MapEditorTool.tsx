import React, { useState, useEffect } from 'react';
import { apiClient } from './apiClient';

export const MapEditorTool: React.FC = () => {
  const [mapData, setMapData] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiClient.get('/map/data')
      .then(data => setMapData(JSON.stringify(data, null, 2)))
      .catch(() => setError("Erreur de chargement de la carte."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const parsed = JSON.parse(mapData);
      await apiClient.post('/map/data', parsed);
      setSuccessMessage('Données géographiques sauvegardées avec succès.');
    } catch {
      setError("Erreur : Le format JSON est invalide.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Éditeur de Carte</h2>
        <p className="text-xs text-gray-500">Modifiez manuellement les lieux et distances de votre univers (Format JSON structuré).</p>
      </div>
      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
      {successMessage && <div className="p-3 bg-green-50 text-green-700 text-xs rounded-lg border border-green-100">{successMessage}</div>}
      <textarea
        value={mapData}
        onChange={(e) => setMapData(e.target.value)}
        disabled={loading}
        className="w-full h-40 p-2 text-xs font-mono border border-gray-300 rounded-md bg-gray-50 focus:ring-2 focus:ring-amber-500 outline-none resize-y"
      />
      <button onClick={handleSave} disabled={saving || loading} className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none">
        {saving ? 'Sauvegarde...' : 'Enregistrer la carte'}
      </button>
    </div>
  );
};
