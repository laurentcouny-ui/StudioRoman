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
    <div className="flex space-x-1 bg-gray-200/60 p-1 rounded-lg self-start">
      {tones.map((t) => (
        <button
          key={t.id}
          onClick={() => onToneChange(t.id)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            selectedTone === t.id ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};
