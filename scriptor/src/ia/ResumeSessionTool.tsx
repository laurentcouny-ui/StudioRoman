import React, { useCallback, useState } from 'react';
import { apiClient } from './apiClient';
import { ToneSelector, Tone } from './ToneSelector';

interface ResumeData {
  lastLines: string;
  activeCharacterState: string;
  nextStep: string;
  openAnnotations: string[];
  aiQuestion: string;
}

interface ResumeSessionToolProps {
  editorText: string;
  autoTrigger?: boolean;
}

export const ResumeSessionTool: React.FC<ResumeSessionToolProps> = ({ editorText, autoTrigger }) => {
  const [tone, setTone] = useState<Tone>('co_auteur');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ResumeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasTriggered = React.useRef(false);

  const handleGenerateResume = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const annotationsRaw = await apiClient.get('/annotations');
      const openAnnotations = annotationsRaw.map((ann: any) => ann.tag);
      
      const response = await apiClient.post('/resume/generate', {
        lastContext: editorText,
        openAnnotations: openAnnotations,
        tone: tone
      });
      
      setData(response);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la génération de la fiche de reprise.");
    } finally {
      setLoading(false);
    }
  }, [editorText, tone]);

  React.useEffect(() => {
    if (autoTrigger && !hasTriggered.current) {
      hasTriggered.current = true;
      handleGenerateResume();
    }
  }, [autoTrigger, handleGenerateResume]);

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Fiche de Reprise</h2>
        <p className="text-xs text-gray-500">
          Idéal après une pause. L'IA résume votre dernière session et vous remet dans le bain.
        </p>
      </div>
      
      <ToneSelector selectedTone={tone} onToneChange={setTone} />

      <button
        onClick={handleGenerateResume}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none"
      >
        {loading ? 'Génération en cours...' : 'Générer la fiche de reprise'}
      </button>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {data && (
        <div className="flex flex-col space-y-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded-lg text-sm">
          <div>
            <span className="font-semibold text-gray-700 block text-xs uppercase mb-1">Dernières lignes</span>
            <p className="italic text-gray-600">"{data.lastLines}"</p>
          </div>
          <div>
            <span className="font-semibold text-gray-700 block text-xs uppercase mb-1">Personnage actif</span>
            <p className="text-emerald-800 font-medium">{data.activeCharacterState}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-700 block text-xs uppercase mb-1">Prochaine étape</span>
            <p className="text-gray-800">{data.nextStep}</p>
          </div>
          {data.openAnnotations.length > 0 && (
            <div>
              <span className="font-semibold text-gray-700 block text-xs uppercase mb-1">Annotations en suspens</span>
              <div className="flex flex-wrap gap-1">
                {data.openAnnotations.map((ann, idx) => (
                  <span key={idx} className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded border border-yellow-200">{ann}</span>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2 mt-2 border-t border-emerald-200/60">
            <span className="font-bold text-emerald-900 block mb-1">Question IA :</span>
            <p className="text-gray-800">{data.aiQuestion}</p>
          </div>
        </div>
      )}
    </div>
  );
};
