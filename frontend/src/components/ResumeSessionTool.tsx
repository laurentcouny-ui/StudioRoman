import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';
import { Tone } from './ToneSelector';

interface ResumeData {
  lastLines: string;
  activeCharacterState: string;
  nextStep: string;
  openAnnotations: string[];
  aiQuestion: string;
}

interface ResumeSessionToolProps {
  editorText: string;
  tone: Tone;
  autoTrigger?: boolean;
}

export const ResumeSessionTool: React.FC<ResumeSessionToolProps> = ({ editorText, tone, autoTrigger }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ResumeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasTriggered = React.useRef(false);

  React.useEffect(() => {
    if (autoTrigger && !hasTriggered.current) {
      hasTriggered.current = true;
      handleGenerateResume();
    }
  }, [autoTrigger]);

  const handleGenerateResume = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const annotationsRaw = await apiClient.get('/annotations');
      const openAnnotations = Array.isArray(annotationsRaw) ? annotationsRaw.map((ann: any) => ann.tag) : [];

      const response = await apiClient.post('/resume/generate', {
        lastContext: editorText,
        openAnnotations,
        tone,
      });

      setData(response);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération de la fiche de reprise.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-3 p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
      <div>
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Fiche de Reprise</h2>
        <p className="text-xs text-slate-400 mt-0.5">Idéal après une pause. L'IA vous remet dans le bain.</p>
      </div>

      <button
        onClick={handleGenerateResume}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-amber-400 focus:outline-none"
      >
        {loading ? 'Génération en cours...' : 'Reprendre la session'}
      </button>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>
      )}

      {data && (
        <div className="flex flex-col space-y-3 p-4 bg-amber-50 border border-amber-100 rounded-lg text-sm">
          <div>
            <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Dernières lignes</span>
            <p className="italic text-slate-700">"{data.lastLines}"</p>
          </div>
          <div>
            <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Personnage actif</span>
            <p className="text-amber-700 font-medium">{data.activeCharacterState}</p>
          </div>
          {data.openAnnotations.length > 0 && (
            <div>
              <span className="font-semibold text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Annotations en suspens</span>
              <div className="flex flex-wrap gap-1">
                {data.openAnnotations.map((ann, idx) => (
                  <span key={idx} className="bg-white text-amber-700 text-xs px-2 py-0.5 rounded border border-amber-200">{ann}</span>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2 mt-1 border-t border-amber-200/60">
            <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider mb-1">Question IA</span>
            <p className="text-slate-700">{data.aiQuestion}</p>
          </div>
        </div>
      )}
    </div>
  );
};
