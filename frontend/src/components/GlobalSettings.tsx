import React, { useState } from 'react';
import { apiClient } from '../services/apiClient';

interface GlobalSettingsProps {
  onToast: (message: string, type?: 'success' | 'error') => void;
}

export const GlobalSettings: React.FC<GlobalSettingsProps> = ({ onToast }) => {
  const [offlineMode, setOfflineMode] = useState(false);
  const [silentMode, setSilentMode] = useState(false);
  const [provider, setProvider] = useState('OllamaLocalProvider');
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleToggleOffline = async () => {
    const newValue = !offlineMode;
    setOfflineMode(newValue);
    try {
      await apiClient.post('/settings/offline', { offlineMode: newValue });
    } catch (e) {
      console.error(e);
      setOfflineMode(!newValue);
    }
  };

  const handleToggleSilent = async () => {
    const newValue = !silentMode;
    setSilentMode(newValue);
    try {
      await apiClient.post('/settings/silent', { silentMode: newValue });
    } catch (e) {
      console.error(e);
      setSilentMode(!newValue);
    }
  };

  const handleChangeProvider = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setProvider(newValue);
    try {
      await apiClient.post('/settings/provider', { providerId: newValue });
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
      setTestResult({ success: false, message: e.message || 'Erreur de connexion' });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveApiKey = async () => {
    setSavingKey(true);
    try {
      await apiClient.post('/settings/apikey', { providerId: provider, apiKey });
      setApiKey('');
      setTestResult(null);
      onToast('Clé sauvegardée et chiffrée en local.', 'success');
    } catch (e) {
      console.error(e);
      onToast('Erreur lors de la sauvegarde de la clé.', 'error');
    } finally {
      setSavingKey(false);
    }
  };

  const getCostEstimation = () => {
    if (provider === 'OpenAIProvider') return '~0.015$ / 1K tokens (GPT-4o)';
    if (provider === 'AnthropicProvider') return '~0.015$ / 1K tokens (Claude 3.5)';
    if (provider === 'GeminiProvider') return '~0.007$ / 1K tokens (Gemini 2.5)';
    return 'Gratuit (local)';
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col space-y-1.5">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Modèle LLM</label>
        <select
          value={provider}
          onChange={handleChangeProvider}
          disabled={offlineMode}
          className="p-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-400 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <option value="OllamaLocalProvider">Ollama (Local — Gratuit)</option>
          <option value="GeminiProvider">Google Gemini</option>
          <option value="OpenAIProvider">OpenAI GPT-4</option>
          <option value="AnthropicProvider">Anthropic Claude</option>
        </select>
      </div>

      {provider !== 'OllamaLocalProvider' && !offlineMode && (
        <div className="flex flex-col space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Clé API (chiffrée localement)</label>
          <div className="flex space-x-2">
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 p-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-amber-400 outline-none"
            />
            <button
              onClick={handleTestApiKey}
              disabled={testingKey || !apiKey}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 disabled:opacity-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
            >
              Tester
            </button>
            <button
              onClick={handleSaveApiKey}
              disabled={savingKey || !apiKey}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Sauver
            </button>
          </div>
          {testResult && (
            <span className={`text-[10px] font-medium ${testResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
              {testResult.message}
            </span>
          )}
          <span className="text-[10px] text-amber-600 font-medium">{getCostEstimation()}</span>
        </div>
      )}

      <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-700">
        <label className="flex items-center justify-between cursor-pointer" onClick={handleToggleOffline}>
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">Mode Hors-Ligne</p>
            <p className="text-[10px] text-slate-400 leading-tight">Force le modèle local. Coupe toute connexion externe.</p>
          </div>
          <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ml-3 flex-shrink-0 ${offlineMode ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-600'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${offlineMode ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
        </label>

        <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-700" onClick={handleToggleSilent}>
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">Mode Silencieux</p>
            <p className="text-[10px] text-slate-400 leading-tight">L'IA est en veille et ne vous sollicitera plus.</p>
          </div>
          <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ml-3 flex-shrink-0 ${silentMode ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-600'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${silentMode ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
        </label>
      </div>
    </div>
  );
};
