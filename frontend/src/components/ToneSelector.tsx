import React from 'react';

export type Tone = 'co_auteur' | 'editeur' | 'lecteur';

interface ToneSelectorProps {
  selectedTone: Tone;
  onToneChange: (tone: Tone) => void;
}

export const ToneSelector: React.FC<ToneSelectorProps> = ({ selectedTone, onToneChange }) => {
  const tones: { id: Tone; label: string }[] = [
    { id: 'co_auteur', label: 'Co-auteur' },
    { id: 'editeur', label: 'Éditeur' },
    { id: 'lecteur', label: 'Lecteur' },
  ];

  return (
    <div className="flex space-x-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg self-start">
      {tones.map((t) => (
        <button
          key={t.id}
          onClick={() => onToneChange(t.id)}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
            selectedTone === t.id
              ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-amber-400'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};
