/**
 * Visite guidée 9 étapes — Brique 5 séquence 4 (première ouverture + replay depuis le Guide).
 */
import { useState } from 'react'

const STEPS = [
  {
    title: '1 — Choisir son mode',
    body: 'Mode Simple : vous travaillez en silence ; peu de signaux jusqu’à « Analyser ». Simple strict : aucun signal visuel avant l’analyse. Expert : niveaux de confiance, styles, analyses détaillées. Vous pourrez changer de mode dans les paramètres du correcteur sous l’éditeur.',
  },
  {
    title: '2 — Délai de grâce',
    body: 'Le curseur « Grâce » (ms) définit après combien de temps d’inactivité les corrections silencieuses s’appliquent — ou au changement de paragraphe. Vous n’êtes pas interrompu pendant la frappe.',
  },
  {
    title: '3 — Les soulignements',
    body: 'Trait net : faute très probable. Pointillés / micro-point : zone à vérifier. Violet : cohérence Bible, pas une faute grammaticale. Rien : Scriptor préfère se taire plutôt que d’affirmer à tort.',
  },
  {
    title: '4 — La promesse',
    body: 'Votre texte n’est pas envahi de soulignements sans votre accord. Par défaut le correcteur reste discret ; une analyse complète, c’est vous qui la demandez avec « Analyser ».',
  },
  {
    title: '5 — Journal des Silencieuses',
    body: 'L’icône plume (modes Simple / Expert) ouvre le journal : doubles espaces, typographie, etc. Badge de session, « Tout valider sauf… », et rétablir un paragraphe si besoin.',
  },
  {
    title: '6 — Correcteur premium (optionnel)',
    body: 'Si vous avez une clé API Claude, Gemini ou ChatGPT, vous pourrez la connecter dans les paramètres avancés (voir le Guide) pour des explications ou pistes — jamais de correction automatique imposée.',
  },
  {
    title: '7 — Analyse profonde',
    body: '« Analyser » lance LanguageTool, la base linguistique, le contexte (worker) et la Bible du projet : ligne temporelle, homophones, cohérence des noms.',
  },
  {
    title: '8 — Bible connectée',
    body: 'Personnages et lieux alimentent le dictionnaire du correcteur. Deux graphies pour le même nom → alerte violette. Renommage dans la Bible : pensez à harmoniser le texte.',
  },
  {
    title: '9 — Mémoire de style',
    body: '« C’est mon style », indignation « choix de style » : Scriptor mémorise des préférences pour ce projet (profil de style). Plus vous l’utilisez, plus il vous ressemble.',
  },
]

export default function CorrectorOnboarding({ onComplete, onClose, onGoWriting }) {
  const [step, setStep] = useState(0)
  const last = step >= STEPS.length - 1
  const s = STEPS[step]

  return (
    <div className="corrector-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="corrector-onb-title">
      <div className="corrector-onboarding-panel">
        <h2 id="corrector-onb-title" className="corrector-onboarding-title">
          Bienvenue — le correcteur Scriptor
        </h2>
        <p className="corrector-onboarding-step">{s.title}</p>
        <p className="corrector-onboarding-body">{s.body}</p>
        {step === 0 && (
          <p className="corrector-onboarding-hint">
            Astuce : ouvrez l’onglet <strong>Écriture</strong> pour voir la barre du correcteur en situation réelle.
          </p>
        )}
        <div className="corrector-onboarding-actions">
          {typeof onGoWriting === 'function' ? (
            <button type="button" className="corrector-onboarding-btn secondary" onClick={() => onGoWriting()}>
              Aller à l’Écriture
            </button>
          ) : null}
          <button
            type="button"
            className="corrector-onboarding-btn secondary"
            onClick={() => onClose?.()}
          >
            Fermer
          </button>
          {!last ? (
            <button type="button" className="corrector-onboarding-btn primary" onClick={() => setStep((x) => x + 1)}>
              Suivant
            </button>
          ) : (
            <button
              type="button"
              className="corrector-onboarding-btn primary"
              onClick={() => onComplete?.()}
            >
              C’est parti — commençons à écrire
            </button>
          )}
        </div>
        <p className="corrector-onboarding-footer">
          Étape {step + 1} / {STEPS.length} — rejouer depuis le menu <strong>Guide</strong>.
        </p>
      </div>
    </div>
  )
}
