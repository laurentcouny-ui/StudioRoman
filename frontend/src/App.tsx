import React, { useState, useEffect, useRef } from 'react';
import { AIPanel } from './components/AIPanel';
import { apiClient } from './services/apiClient';

interface Annotation {
  id?: string;
  debut: number;
  fin: number;
  tag: string;
  timestamp?: number;
}

function App() {
  const [editorText, setEditorText] = useState("");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [autoTriggerResume, setAutoTriggerResume] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // 1. Charger les annotations existantes au démarrage
  useEffect(() => {
    apiClient.get('/annotations').then(setAnnotations).catch(console.error);

    // Détection de la règle des 24h d'absence (86400000 ms)
    const lastSessionStr = localStorage.getItem('scriptor_last_session');
    const now = Date.now();
    
    if (lastSessionStr) {
      const lastSession = parseInt(lastSessionStr, 10);
      if (now - lastSession > 86400000) {
        setAutoTriggerResume(true);
      }
    }
    
    localStorage.setItem('scriptor_last_session', now.toString());
    const interval = setInterval(() => {
      localStorage.setItem('scriptor_last_session', Date.now().toString());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Application du mode sombre sur la balise HTML racine
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // 2. Détecter la sélection de texte par l'auteur
  const handleSelect = () => {
    if (!textAreaRef.current) return;
    const start = textAreaRef.current.selectionStart;
    const end = textAreaRef.current.selectionEnd;
    setSelection({ start, end }); // On enregistre même les simples clics pour détecter la position du curseur
  };

  // 3. Synchroniser le défilement (Scroll) entre le textarea et le calque de couleur
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // 4. Sauvegarder l'annotation et l'afficher
  const addAnnotation = async (tag: string) => {
    if (!selection) return;
    setIsSaving(true);
    const newAnn = { debut: selection.start, fin: selection.end, tag };
    try {
      const saved = await apiClient.post('/annotations', newAnn);
      setAnnotations((prev) => [...prev, saved]);
      setSelection(null);
    } catch (e) {
      console.error("Erreur lors de l'ajout de l'annotation", e);
    } finally {
      setIsSaving(false);
    }
  };

  // 4b. Effacer une annotation (résolue)
  const removeAnnotation = async (id?: string) => {
    if (!id) return;
    setIsSaving(true);
    try {
      await apiClient.delete(`/annotations/${id}`);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error("Erreur lors de la suppression de l'annotation", e);
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Générer le calque de surbrillance
  const renderHighlights = () => {
    if (!annotations || annotations.length === 0) return editorText;
    const sorted = [...annotations].sort((a, b) => a.debut - b.debut);
    let lastIndex = 0;
    const elements = [];
    
    sorted.forEach((ann, idx) => {
      // Sécurité anti-débordement si le texte a été modifié
      if (ann.debut >= lastIndex && ann.fin <= editorText.length) {
        elements.push(<span key={`text-${idx}`}>{editorText.slice(lastIndex, ann.debut)}</span>);
        
        let colorClass = "";
        if (ann.tag === 'pas satisfait') colorClass = "bg-red-200/60 underline decoration-red-500 decoration-wavy underline-offset-4";
        else if (ann.tag === 'à développer') colorClass = "bg-blue-200/60 underline decoration-blue-500 decoration-dotted underline-offset-4";
        else if (ann.tag === 'idée ici') colorClass = "bg-green-200/60 underline decoration-green-500 underline-offset-4";

        elements.push(
          <mark key={`mark-${idx}`} className={`text-transparent ${colorClass} rounded-sm`}>
            {editorText.slice(ann.debut, ann.fin)}
          </mark>
        );
        lastIndex = ann.fin;
      }
    });
    elements.push(<span key="text-end">{editorText.slice(lastIndex)}</span>);
    return elements;
  };

  // Styles identiques stricts pour garantir l'alignement parfait des deux calques
  // On aère la lecture avec un grand padding et un interligne généreux (leading-loose)
  const sharedStyles = "w-full h-full p-10 text-lg font-serif leading-loose whitespace-pre-wrap break-words";

  // Détection du mode de la barre d'outils
  const isSelecting = selection !== null && selection.start !== selection.end;
  const activeAnnotation = (selection && !isSelecting) 
    ? annotations.find(ann => selection.start >= ann.debut && selection.start <= ann.fin)
    : null;

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* Indicateur de sauvegarde global (Message d'attente) */}
      {isSaving && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-2.5 rounded-full shadow-lg text-xs font-bold uppercase tracking-wider animate-pulse z-50 flex items-center space-x-2">
          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span>Sauvegarde en cours...</span>
        </div>
      )}

      {/* Zone Centrale : L'Éditeur de texte */}
      <div className="flex-1 flex flex-col relative bg-white dark:bg-slate-900 m-4 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        <div className="px-10 pt-8 pb-4 flex flex-col border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-20 transition-colors duration-300">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Le Sanctuaire</h2>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700">
              {isDarkMode ? '☀️ Mode Clair' : '🌙 Mode Sombre'}
            </button>
          </div>
          
          {/* Toolbar flottante d'annotation (Apparaît si texte sélectionné) */}
          <div className="h-10 flex items-center">
            {isSelecting ? (
              <div className="flex items-center space-x-2 bg-gray-50 dark:bg-slate-800 p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm transition-all">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 uppercase tracking-wider">Annoter :</span>
                <button onClick={() => addAnnotation('pas satisfait')} className="px-3 py-1 text-xs font-semibold bg-white text-red-600 border border-red-200 rounded hover:bg-red-50">Pas satisfait</button>
                <button onClick={() => addAnnotation('à développer')} className="px-3 py-1 text-xs font-semibold bg-white text-blue-600 border border-blue-200 rounded hover:bg-blue-50">À développer</button>
                <button onClick={() => addAnnotation('idée ici')} className="px-3 py-1 text-xs font-semibold bg-white text-green-600 border border-green-200 rounded hover:bg-green-50">Idée ici</button>
              </div>
            ) : activeAnnotation ? (
              <div className="flex items-center space-x-2 bg-gray-50 dark:bg-slate-800 p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm transition-all">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 uppercase tracking-wider">Annotation [{activeAnnotation.tag}] :</span>
                <button onClick={() => removeAnnotation(activeAnnotation.id)} className="px-3 py-1 text-xs font-semibold bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-600 rounded hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors">Résoudre / Effacer</button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-slate-500 italic">Sélectionnez du texte pour ajouter une annotation IA, ou cliquez sur une annotation pour la résoudre.</p>
            )}
          </div>
        </div>

        {/* Conteneur Éditeur + Surbrillance */}
        <div className="relative flex-1 w-full max-w-4xl mx-auto mt-4 mb-12">
          
          {/* Calque Arrière : La surbrillance colorée */}
          <div 
            ref={backdropRef}
            className={`absolute inset-0 text-transparent pointer-events-none overflow-hidden ${sharedStyles}`}
            aria-hidden="true"
          >
            {renderHighlights()}
          </div>

          {/* Calque Avant : Le Textarea interactif */}
          <textarea 
            ref={textAreaRef}
            className={`absolute inset-0 bg-transparent resize-none outline-none text-slate-800 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-700 overflow-y-auto z-10 ${sharedStyles}`}
            placeholder="Il était une fois..."
            value={editorText}
            onChange={(e) => setEditorText(e.target.value)}
            onSelect={handleSelect}
            onScroll={handleScroll}
          />
        </div>
      </div>

      {/* Sidebar Droite : Le Panneau IA */}
      <AIPanel editorText={editorText} autoTriggerResume={autoTriggerResume} />
      
    </div>
  );
}

export default App;
