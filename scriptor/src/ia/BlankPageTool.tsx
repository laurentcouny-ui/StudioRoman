import React, { useState } from 'react';
import { apiClient } from './apiClient';
import { ToneSelector, Tone } from './ToneSelector';

interface BlankPageToolProps {
  editorText: string;
}

export const BlankPageTool: React.FC<BlankPageToolProps> = ({ editorText }) => {
  const [tone, setTone] = useState<Tone>('co_auteur');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDiagnose = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.post('/page-blanche/diagnose', {
        fullText: editorText,
        cursorPosition: editorText.length,
        tone: tone
      });
      
      setResult(response.questions);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors du diagnostic.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Page Blanche</h2>
        <p className="text-xs text-gray-500">
          Bloqué ? L'IA analyse les dernières lignes et vous pose des questions pour vous relancer.
        </p>
      </div>
      
      <ToneSelector selectedTone={tone} onToneChange={setTone} />

      <button
        onClick={handleDiagnose}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
      >
        {loading ? 'Analyse en cours...' : 'Débloquer la scène'}
      </button>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{result}</div>
        </div>
      )}
    </div>
  );
};
