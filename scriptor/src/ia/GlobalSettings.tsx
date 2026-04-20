import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from './apiClient';

export const GlobalSettings: React.FC = () => {
  const [offlineMode, setOfflineMode] = useState(false);
  const [silentMode, setSilentMode] = useState(false);
  const [provider, setProvider] = useState('OllamaLocalProvider');

  const persistLocalSettings = useCallback((next: { offlineMode?: boolean; silentMode?: boolean; providerId?: string }) => {
    try {
      const raw = localStorage.getItem('scriptor_ia_settings')
      const prev = raw ? JSON.parse(raw) : {}
      const merged = {
        offlineMode: typeof next.offlineMode === 'boolean' ? next.offlineMode : !!prev.offlineMode,
        silentMode: typeof next.silentMode === 'boolean' ? next.silentMode : !!prev.silentMode,
        providerId: typeof next.providerId === 'string' ? next.providerId : (prev.providerId || 'OllamaLocalProvider'),
      }
      localStorage.setItem('scriptor_ia_settings', JSON.stringify(merged))
      window.dispatchEvent(new CustomEvent('scriptor-ia-settings-changed', { detail: merged }))
    } catch {
      // no-op
    }
  }, [])

  useEffect(() => {
    apiClient.get('/settings').then((data: any) => {
      if (typeof data.offlineMode === 'boolean') setOfflineMode(data.offlineMode);
      if (typeof data.silentMode === 'boolean') setSilentMode(data.silentMode);
      if (typeof data.providerId === 'string') setProvider(data.providerId);
      if (typeof data.ollamaModel === 'string' && data.ollamaModel) setOllamaModel(data.ollamaModel);
      persistLocalSettings({
        offlineMode: data.offlineMode,
        silentMode: data.silentMode,
        providerId: data.providerId,
      })
    }).catch(() => { /* backend injoignable, on garde les défauts */ });
  }, [persistLocalSettings]);
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveNotice, setSaveNotice] = useState<{ success: boolean; message: string } | null>(null);
  const [estimateChars, setEstimateChars] = useState(10_000);
  const [costLive, setCostLive] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<{
    reachable: boolean;
    message: string;
    model?: string;
  } | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModel, setOllamaModel] = useState<string>('');

  useEffect(() => {
    if (!offlineMode && provider !== 'OllamaLocalProvider') {
      setOllamaStatus(null);
      setOllamaModels([]);
      return;
    }
    let cancelled = false;
    const poll = () => {
      apiClient
        .get('/ollama/status')
        .then((data: any) => {
          if (cancelled) return;
          setOllamaStatus({
            reachable: !!data.reachable,
            message: typeof data.message === 'string' ? data.message : '',
            model: typeof data.model === 'string' ? data.model : undefined,
          });
        })
        .catch(() => {
          if (!cancelled) setOllamaStatus(null);
        });
      apiClient
        .get('/settings/ollama/models')
        .then((data: any) => {
          if (cancelled) return;
          if (Array.isArray(data.models)) setOllamaModels(data.models);
          if (typeof data.current === 'string' && data.current) setOllamaModel(data.current);
        })
        .catch(() => {});
    };
    poll();
    const id = window.setInterval(poll, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [provider, offlineMode]);

  const handleChangeOllamaModel = async (model: string) => {
    setOllamaModel(model);
    try {
      await apiClient.post('/settings/ollama/model', { model });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (provider === 'OllamaLocalProvider' || offlineMode) {
      setCostLive(null);
      return;
    }
    let cancelled = false;
    apiClient
      .post('/settings/cost-estimate', { charCount: estimateChars, providerId: provider })
      .then((r: any) => {
        if (cancelled) return;
        const usd = typeof r.estimatedUsdInput === 'number' ? r.estimatedUsdInput : 0;
        const tok = typeof r.estimatedTokens === 'number' ? r.estimatedTokens : 0;
        setCostLive(
          `Pour environ ${estimateChars.toLocaleString('fr-FR')} caractères : volume estimé côté fournisseur ~${tok.toLocaleString('fr-FR')} unités (entrée), ordre de grandeur ~${usd.toFixed(4)} USD (tarifs publics).`,
        );
      })
      .catch(() => {
        if (!cancelled) setCostLive(null);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, offlineMode, estimateChars]);

  const handleToggleOffline = async () => {
    const newValue = !offlineMode;
    setOfflineMode(newValue);
    try {
      await apiClient.post('/settings/offline', { offlineMode: newValue });
      persistLocalSettings({ offlineMode: newValue })
    } catch (e) {
      console.error(e);
      setOfflineMode(!newValue); // Restauration en cas d'erreur
    }
  };

  const handleToggleSilent = async () => {
    const newValue = !silentMode;
    setSilentMode(newValue);
    try {
      await apiClient.post('/settings/silent', { silentMode: newValue });
      persistLocalSettings({ silentMode: newValue })
    } catch (e) {
      console.error(e);
      setSilentMode(!newValue); // Restauration en cas d'erreur
    }
  };

  const handleChangeProvider = async (newValue: string) => {
    setProvider(newValue);
    try {
      await apiClient.post('/settings/provider', { providerId: newValue });
      persistLocalSettings({ providerId: newValue })
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestApiKey = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await apiClient.post('/settings/apikey/test', { providerId: provider, apiKey });
      setTestResult(res);
    } catch (e: any) {
      console.error(e);
      setTestResult({ success: false, message: e.message || "Erreur de connexion" });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveApiKey = async () => {
    setSavingKey(true);
    setSaveNotice(null);
    try {
      await apiClient.post('/settings/apikey', { providerId: provider, apiKey });
      setApiKey('');
      setTestResult(null);
      setSaveNotice({ success: true, message: 'Clé sauvegardée et chiffrée avec succès en local.' });
    } catch (e) {
      console.error(e);
      setSaveNotice({ success: false, message: 'Erreur lors de la sauvegarde de la clé.' });
    } finally {
      setSavingKey(false);
    }
  };

  const getCostEstimation = () => {
    if (provider === 'OpenAIProvider') return 'Ordre de grandeur facturation cloud : modèle récent type GPT-4o (voir grille du fournisseur).';
    if (provider === 'AnthropicProvider') return 'Ordre de grandeur facturation cloud : famille Claude récente (voir grille du fournisseur).';
    if (provider === 'GeminiProvider') return 'Ordre de grandeur facturation cloud : Gemini récent (voir grille du fournisseur).';
    return 'Sur cette machine : pas de facturation liée au fournisseur cloud.';
  };

  const PROVIDERS: Array<{ id: string; label: string }> = [
    { id: 'OllamaLocalProvider', label: 'Sur votre ordinateur (Ollama)' },
    { id: 'GeminiProvider', label: 'Google Gemini (cloud)' },
    { id: 'OpenAIProvider', label: 'OpenAI (cloud)' },
    { id: 'AnthropicProvider', label: 'Anthropic (cloud)' },
  ];

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50/50 dark:bg-slate-800/50 shadow-sm transition-colors duration-300">
      <div className="flex flex-col space-y-1">
        <h2 className="text-sm font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wider">Réglages de l’assistant</h2>
      </div>

      <div className="space-y-4 pt-1">
        <div className="flex flex-col space-y-1.5">
          <label className="text-xs font-semibold text-gray-600 dark:text-slate-400">Où tourne l’assistant</label>
          <div className="grid grid-cols-1 gap-1.5">
            {PROVIDERS.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors ${
                  provider === p.id
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-slate-700/70'
                    : 'border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-700'
                } ${offlineMode && p.id !== 'OllamaLocalProvider' ? 'opacity-50' : ''}`}
              >
                <input
                  type="radio"
                  name="ia-provider"
                  value={p.id}
                  checked={provider === p.id}
                  disabled={offlineMode && p.id !== 'OllamaLocalProvider'}
                  onChange={(e) => handleChangeProvider(e.target.value)}
                />
                <span className="text-gray-700 dark:text-slate-200">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        {(provider === 'OllamaLocalProvider' || offlineMode) && ollamaStatus && (
          <div
            className={`rounded-md border px-2 py-1.5 text-[10px] ${
              ollamaStatus.reachable
                ? 'border-green-800/40 bg-green-600/10 text-green-950 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-200'
                : 'border-amber-700/50 bg-amber-600/15 text-amber-950 dark:border-amber-600/60 dark:bg-amber-900/25 dark:text-amber-100'
            }`}
            role="status"
          >
            <strong className="font-semibold text-[11px]">
              {ollamaStatus.reachable ? 'Ollama local : prêt' : 'Ollama local : indisponible'}
            </strong>
            <p className="mt-0.5 leading-snug opacity-95">{ollamaStatus.message}</p>
          </div>
        )}

        {(provider === 'OllamaLocalProvider' || offlineMode) && ollamaModels.length > 0 && (
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-400">Modèle Ollama</label>
            <select
              value={ollamaModel}
              onChange={(e) => handleChangeOllamaModel(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {ollamaModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {provider !== 'OllamaLocalProvider' && !offlineMode && (
          <div className="flex flex-col space-y-2 mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-400">Clé d’accès fournisseur (stockée sur cette machine)</label>
            <div className="flex space-x-2">
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." className="flex-1 p-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md dark:bg-slate-700 dark:text-slate-200 focus:outline-none" />
              <button onClick={handleTestApiKey} disabled={testingKey || !apiKey} className="px-3 py-1.5 bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 disabled:opacity-50 text-gray-700 dark:text-slate-200 rounded-md text-xs font-semibold transition-colors">Tester</button>
              <button onClick={handleSaveApiKey} disabled={savingKey || !apiKey} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold transition-colors">Sauver</button>
            </div>
            {testResult && (
              <span className={`text-[10px] font-medium ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.message}
              </span>
            )}
            {saveNotice && (
              <span className={`text-[10px] font-medium ${saveNotice.success ? 'text-green-600' : 'text-red-600'}`}>
                {saveNotice.message}
              </span>
            )}
            <span className="text-[10px] text-orange-600 font-medium">{getCostEstimation()}</span>
            <label className="flex flex-col gap-0.5 text-[10px] text-gray-600 dark:text-slate-400 mt-1">
              Taille de texte pour l’estimation (caractères)
              <input
                type="number"
                min={500}
                max={500000}
                step={500}
                value={estimateChars}
                onChange={(e) => setEstimateChars(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="max-w-[10rem] rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-1.5 py-0.5 text-xs text-gray-800 dark:text-slate-200"
              />
            </label>
            {costLive ? (
              <span className="text-[10px] text-slate-600 dark:text-slate-300">{costLive}</span>
            ) : null}
            <span className="text-[9px] text-gray-400 dark:text-slate-500">Indicatif uniquement ; tarifs et conditions chez le fournisseur.</span>
          </div>
        )}

        {/* Toggle Mode Hors-Ligne */}
        <button
          type="button"
          onClick={handleToggleOffline}
          className="flex w-full items-center justify-between cursor-pointer group text-left"
        >
          <div className="flex flex-col">
            <span className="text-sm text-gray-800 dark:text-slate-200 font-medium">Mode Hors-Ligne</span>
            <span className="text-[10px] text-gray-500 leading-tight">Force le modèle local. Coupe toute connexion externe.</span>
          </div>
          <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ml-2 flex-shrink-0 ${offlineMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${offlineMode ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
        </button>

        {/* Toggle Mode Silencieux */}
        <button
          type="button"
          onClick={handleToggleSilent}
          className="flex w-full items-center justify-between cursor-pointer group border-t border-gray-200 dark:border-slate-700 pt-3 text-left"
        >
          <div className="flex flex-col">
            <span className="text-sm text-gray-800 dark:text-slate-200 font-medium">Mode Silencieux</span>
            <span className="text-[10px] text-gray-500 leading-tight">L'IA est en veille et ne vous sollicitera plus.</span>
          </div>
          <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ml-2 flex-shrink-0 ${silentMode ? 'bg-red-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${silentMode ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
        </button>
      </div>
    </div>
  );
};
