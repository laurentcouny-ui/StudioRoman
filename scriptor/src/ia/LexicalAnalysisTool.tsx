import React, { useState } from 'react';
import { apiClient } from './apiClient';

interface LexicalData {
  topFrequentWords: Record<string, number>;
  detectedForbiddenWords: string[];
  missingImposedWords: string[];
}

interface LexicalAnalysisToolProps {
  editorText: string;
}

export const LexicalAnalysisTool: React.FC<LexicalAnalysisToolProps> = ({ editorText }) => {
  const [loading, setLoading] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [data, setData] = useState<LexicalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rulesNotice, setRulesNotice] = useState<string | null>(null);
  const [forbiddenInput, setForbiddenInput] = useState('');
  const [imposedInput, setImposedInput] = useState('');

  React.useEffect(() => {
    apiClient
      .get('/lexicon/rules')
      .then((rules: any) => {
        const forbidden = Array.isArray(rules?.mots_interdits) ? rules.mots_interdits : []
        const imposed = Array.isArray(rules?.mots_imposes) ? rules.mots_imposes : []
        setForbiddenInput(forbidden.join(', '))
        setImposedInput(imposed.join(', '))
      })
      .catch(() => {})
  }, [])

  const splitCsv = (raw: string): string[] =>
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await apiClient.post('/lexicon/analyze', {
        text: editorText
      });
      
      setData(response);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'analyse lexicale.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRules = async () => {
    setSavingRules(true)
    setRulesNotice(null)
    try {
      const payload = {
        mots_interdits: splitCsv(forbiddenInput),
        mots_imposes: splitCsv(imposedInput),
      }
      const saved = await apiClient.post('/lexicon/rules', payload)
      const forb = Array.isArray(saved?.mots_interdits) ? saved.mots_interdits : payload.mots_interdits
      const imp = Array.isArray(saved?.mots_imposes) ? saved.mots_imposes : payload.mots_imposes
      setForbiddenInput(forb.join(', '))
      setImposedInput(imp.join(', '))
      setRulesNotice('Contraintes lexicales enregistrées.')
    } catch (err: any) {
      setRulesNotice(err?.message || 'Erreur lors de la sauvegarde des contraintes.')
    } finally {
      setSavingRules(false)
    }
  }

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Contraintes Lexicales</h2>
        <p className="text-xs text-gray-500">
          Vérifiez vos tics de langage, mots surutilisés et le respect du lexique de votre univers.
        </p>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none"
      >
        {loading ? 'Analyse en cours...' : 'Analyser le lexique'}
      </button>

      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Contraintes personnalisées
        </p>
        <div className="grid grid-cols-1 gap-2">
          <label className="text-xs text-gray-700">
            Mots interdits (séparés par des virgules)
            <input
              type="text"
              value={forbiddenInput}
              onChange={(e) => setForbiddenInput(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ex: vraiment, soudain, juste"
            />
          </label>
          <label className="text-xs text-gray-700">
            Mots imposés (séparés par des virgules)
            <input
              type="text"
              value={imposedInput}
              onChange={(e) => setImposedInput(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ex: citadelle, brume, serment"
            />
          </label>
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            onClick={handleSaveRules}
            disabled={savingRules}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {savingRules ? 'Sauvegarde...' : 'Sauvegarder les contraintes'}
          </button>
        </div>
        {rulesNotice && <p className="mt-2 text-xs text-indigo-700">{rulesNotice}</p>}
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}

      {data && (
        <div className="flex flex-col space-y-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-sm">
          <div>
            <span className="font-semibold text-gray-700 block text-xs uppercase mb-1">Mots fréquents (hors liaison)</span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.topFrequentWords).map(([word, count]) => (
                <span key={word} className="bg-white text-indigo-800 text-xs px-2 py-0.5 rounded border border-indigo-200">
                  {word} ({count})
                </span>
              ))}
            </div>
          </div>

          {(data.detectedForbiddenWords.length > 0 || data.missingImposedWords.length > 0) && (
            <div className="pt-2 border-t border-indigo-200/60 space-y-2">
              {data.detectedForbiddenWords.length > 0 && <p className="text-red-700 text-xs"><span className="font-bold">Interdits détectés :</span> {data.detectedForbiddenWords.join(', ')}</p>}
              {data.missingImposedWords.length > 0 && <p className="text-orange-700 text-xs"><span className="font-bold">Lexique manquant :</span> {data.missingImposedWords.join(', ')}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
