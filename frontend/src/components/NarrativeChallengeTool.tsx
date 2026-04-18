import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

type ChallengeType = 'express' | 'style' | 'lacune_bible' | 'personnage_oublie';

const CHALLENGE_LABELS: Record<ChallengeType, string> = {
  express: 'Défi Express',
  style: 'Contrainte Stylistique',
  lacune_bible: 'Lacune de Bible',
  personnage_oublie: 'Personnage Oublié',
};

interface TimerInfo {
  timeLeft: number;
  label: string;
}

interface NarrativeChallengeToolProps {
  onTimerUpdate?: (info: TimerInfo | null) => void;
}

export const NarrativeChallengeTool: React.FC<NarrativeChallengeToolProps> = ({ onTimerUpdate }) => {
  const [challengeType, setChallengeType] = useState<ChallengeType>('express');
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          const next = prev - 1;
          onTimerUpdate?.(next > 0 ? { timeLeft: next, label: CHALLENGE_LABELS[challengeType] } : null);
          return next;
        });
      }, 1000);
    } else if (timeLeft === 0 && timerActive) {
      setTimerActive(false);
      onTimerUpdate?.(null);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setChallenge(null);
    setTimerActive(false);
    onTimerUpdate?.(null);

    try {
      const response = await apiClient.post('/challenges/generate', {
        challengeType,
        contextData: '',
      });
      setChallenge(response.generatedChallenge);
      setTimeLeft(challengeType === 'express' ? 5 * 60 : 15 * 60);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération du défi.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTimer = () => {
    const next = !timerActive;
    setTimerActive(next);
    if (next && timeLeft > 0) {
      onTimerUpdate?.({ timeLeft, label: CHALLENGE_LABELS[challengeType] });
    } else {
      onTimerUpdate?.(null);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col space-y-3 p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
      <div>
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Défis Narratifs</h2>
        <p className="text-xs text-slate-400 mt-0.5">Sortez de votre zone de confort. Le timer apparaît dans l'éditeur.</p>
      </div>

      <select
        value={challengeType}
        onChange={(e) => setChallengeType(e.target.value as ChallengeType)}
        className="p-2 text-sm border border-slate-200 rounded-lg bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-amber-400 outline-none"
      >
        <option value="express">Défi Express — 5 min</option>
        <option value="style">Contrainte Stylistique — 15 min</option>
        <option value="lacune_bible">Lacune de Bible — 15 min</option>
        <option value="personnage_oublie">Personnage Oublié — 15 min</option>
      </select>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-amber-400 focus:outline-none"
      >
        {loading ? 'Création du défi...' : 'Générer un défi'}
      </button>

      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}

      {challenge && (
        <div className="flex flex-col space-y-3 p-4 bg-amber-50 border border-amber-100 rounded-lg">
          <p className="text-sm text-slate-800 leading-relaxed italic">"{challenge}"</p>
          <div className="flex items-center justify-between pt-2 border-t border-amber-200/60">
            <span className={`text-xl font-mono font-bold ${timeLeft === 0 ? 'text-red-500' : 'text-amber-700'}`}>
              {formatTime(timeLeft)}
            </span>
            <button
              onClick={handleToggleTimer}
              disabled={timeLeft === 0}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-40
                ${timerActive ? 'bg-slate-500 hover:bg-slate-600' : 'bg-amber-500 hover:bg-amber-600'}`}
            >
              {timerActive ? 'Pause' : timeLeft === 0 ? 'Terminé' : 'Démarrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
