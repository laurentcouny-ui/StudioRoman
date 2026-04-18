import React, { useState, useEffect } from 'react';
import { apiClient } from './apiClient';

type ChallengeType = 'express' | 'style' | 'lacune_bible' | 'personnage_oublie';

interface NarrativeChallengeToolProps {
  editorText?: string;
}

export const NarrativeChallengeTool: React.FC<NarrativeChallengeToolProps> = ({ editorText = '' }) => {
  const [challengeType, setChallengeType] = useState<ChallengeType>('express');
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextData, setContextData] = useState('');

  // États du minuteur
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [timerActive, setTimerActive] = useState(false);

  // Gestion du chronomètre
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timerActive && timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setChallenge(null);
    setTimerActive(false);

    try {
      const response = await apiClient.post('/challenges/generate', {
        challengeType: challengeType,
        contextData: contextData.trim(),
        recentText: editorText,
      });
      
      setChallenge(response.generatedChallenge);
      
      // Initialisation du temps : 5 min pour express, 15 min pour le reste
      setTimeLeft(challengeType === 'express' ? 5 * 60 : 15 * 60);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la génération du défi.");
    } finally {
      setLoading(false);
    }
  };

  const toggleTimer = () => setTimerActive(!timerActive);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col space-y-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex flex-col space-y-2">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Défis Narratifs</h2>
        <p className="text-xs text-gray-500">
          Sélectionnez un type de défi. L'IA générera une consigne courte pour vous faire écrire hors de votre zone de confort.
        </p>
      </div>

      <select
        value={challengeType}
        onChange={(e) => setChallengeType(e.target.value as ChallengeType)}
        className="p-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 outline-none"
      >
        <option value="express">Défi Express (5 min)</option>
        <option value="style">Contrainte Stylistique (15 min)</option>
        <option value="lacune_bible">Lacune de Bible (15 min)</option>
        <option value="personnage_oublie">Personnage Oublié (15 min)</option>
      </select>

      {(challengeType === 'personnage_oublie' || challengeType === 'lacune_bible') && (
        <input
          type="text"
          value={contextData}
          onChange={(e) => setContextData(e.target.value)}
          placeholder={
            challengeType === 'personnage_oublie'
              ? 'Contexte optionnel : nom du personnage à cibler'
              : 'Contexte optionnel : lieu/règle à explorer'
          }
          className="p-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 outline-none"
        />
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-semibold rounded-lg transition-colors focus:ring-2 focus:ring-purple-500 focus:outline-none"
      >
        {loading ? 'Création du défi...' : 'Générer un défi'}
      </button>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {challenge && (
        <div className="flex flex-col space-y-4 p-4 bg-purple-50 border border-purple-100 rounded-lg">
          <p className="text-sm text-gray-800 leading-relaxed italic">"{challenge}"</p>
          
          <div className="flex items-center justify-between pt-3 border-t border-purple-200/60">
            <span className={`text-2xl font-mono font-bold ${timeLeft === 0 ? 'text-red-500' : 'text-purple-900'}`}>
              {formatTime(timeLeft)}
            </span>
            <button
              onClick={toggleTimer}
              className={`px-4 py-1.5 rounded-md text-xs font-bold text-white shadow-sm transition-colors ${timerActive ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {timerActive ? 'Pause' : timeLeft === 0 ? 'Terminé' : 'Démarrer le sprint'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
