import React, { useState } from 'react';
import { apiClient } from './apiClient';

interface MapVerificationToolProps {
  editorText: string;
}

export const MapVerificationTool: React.FC<MapVerificationToolProps> = ({ editorText }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const response = await apiClient.post('/map/verify', {
        textToVerify: editorText
      });
      
      setReport(response.report);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la vérification géographique.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Carte & Cohérence</h2>
        <p className="text-xs text-gray-500">
          Vérifiez les temps de trajet et les distances de votre scène par rapport à la carte de votre univers.
        </p>
      </div>

      <button
        onClick={handleVerify}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-amber-500 focus:outline-none"
      >
        {loading ? 'Vérification en cours...' : 'Vérifier la cohérence'}
      </button>

      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}

      {report && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{report}</div>
        </div>
      )}
    </div>
  );
};
