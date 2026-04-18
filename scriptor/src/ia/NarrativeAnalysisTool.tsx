import React, { useState } from 'react';
import { apiClient } from './apiClient';

interface NarrativeAnalysisToolProps {
  editorText: string;
}

export const NarrativeAnalysisTool: React.FC<NarrativeAnalysisToolProps> = ({ editorText }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [segments, setSegments] = useState<number[] | null>(null);
  const [povCount, setPovCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sceneLengthInsights = (() => {
    const cleaned = (editorText || '').trim();
    if (!cleaned) return null;

    // Heuristique légère: sections marquées ou blocs séparés par lignes vides.
    const explicitScenes = cleaned
      .split(/\n(?=\s*(?:scene|scène)\b|\s*#{1,3}\s*(?:scene|scène)\b)/i)
      .map((s) => s.trim())
      .filter(Boolean);
    const fallbackChunks = cleaned
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 120);
    const scenes = (explicitScenes.length >= 2 ? explicitScenes : fallbackChunks).slice(0, 24);
    if (scenes.length === 0) return null;

    const lengths = scenes.map((s) => s.length);
    const avg = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
    const thresholdLong = Math.round(avg * 1.6);
    const thresholdShort = Math.round(avg * 0.5);
    const longIdx = lengths.findIndex((l) => l >= Math.max(thresholdLong, 2200));
    const shortIdx = lengths.findIndex((l) => l <= Math.max(thresholdShort, 500));

    let suggestion = 'Longueurs relativement équilibrées sur les scènes détectées.';
    if (longIdx >= 0) {
      suggestion = `La scène ${longIdx + 1} paraît nettement plus longue que les autres. Suggestion: envisager une découpe en 2 temps narratifs.`;
    } else if (shortIdx >= 0 && scenes.length >= 3) {
      suggestion = `La scène ${shortIdx + 1} est très courte. Suggestion: vérifier si une fusion avec la scène voisine renforcerait le rythme.`;
    }

    return {
      sceneCount: scenes.length,
      averageLength: avg,
      longest: Math.max(...lengths),
      shortest: Math.min(...lengths),
      suggestion,
    };
  })();

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    setSegments(null);
    setPovCount(null);

    try {
      const response = await apiClient.post('/analysis/narrative', {
        text: editorText
      });

      setReport(response.analysisReport);
      if (Array.isArray(response.intensitySegments) && response.intensitySegments.length > 0) {
        setSegments(response.intensitySegments.map((n: number) => Math.max(1, Math.min(10, Number(n) || 1))));
      }
      if (typeof response.povSwitchCount === 'number') setPovCount(response.povSwitchCount);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'analyse narrative.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Rythme Narratif</h2>
        <p className="text-xs text-gray-500">
          Analysez la courbe d'action, la longueur des scènes et les changements de point de vue (POV) de votre texte.
        </p>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-teal-500 focus:outline-none"
      >
        {loading ? 'Analyse en cours...' : 'Analyser le rythme'}
      </button>

      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}

      {segments && segments.length > 0 && (
        <div className="rounded-lg border border-teal-200 bg-white p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-teal-800">
            Tension (aperçu par cinquièmes du texte)
          </p>
          <div className="flex h-24 items-end gap-1">
            {segments.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-teal-500 transition-all"
                  style={{ height: `${(v / 10) * 100}%`, minHeight: '4px' }}
                  title={`Segment ${i + 1} : ${v}/10`}
                />
                <span className="text-[9px] text-gray-500">{i + 1}</span>
              </div>
            ))}
          </div>
          {povCount != null ? (
            <p className="mt-2 text-[10px] text-gray-600">Changements de point de vue estimés : {povCount}</p>
          ) : null}
        </div>
      )}

      {sceneLengthInsights && (
        <div className="rounded-lg border border-teal-200 bg-white p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-teal-800">
            Longueur des scènes (diagnostic)
          </p>
          <p className="text-xs text-gray-700">
            {sceneLengthInsights.sceneCount} scènes détectées, moyenne ~{sceneLengthInsights.averageLength} caractères
            (min {sceneLengthInsights.shortest}, max {sceneLengthInsights.longest}).
          </p>
          <p className="mt-1 text-xs text-gray-700">{sceneLengthInsights.suggestion}</p>
        </div>
      )}

      {report && (
        <div className="p-4 bg-teal-50 border border-teal-100 rounded-lg">
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{report}</div>
        </div>
      )}
    </div>
  );
};
