/**
 * Visite guidée enrichie (première ouverture + replay depuis le Guide).
 */
import { useState } from 'react'

const STEPS = [
  {
    title: '1 — Bienvenue dans Studio Roman',
    body: 'Le didacticiel vous fait gagner du temps : où écrire, où structurer, où sauvegarder, et comment utiliser l’IA sans casser votre flux d’écriture.',
    bullets: [
      'Durée : environ 2 minutes',
      'Vous pouvez le rejouer depuis l’onglet Guide',
      'Il ne se relance pas à chaque ouverture après fermeture',
    ],
  },
  {
    title: '2 — Structure projet',
    body: 'Le panneau gauche pilote toute la saga : tomes, chapitres, scènes. Commencez toujours par la structure avant les raffinements.',
    bullets: [
      'Une saga contient plusieurs tomes',
      'Chaque tome contient chapitres et scènes',
      'Les suppressions sont confirmées, mais restent sensibles',
    ],
  },
  {
    title: '3 — Écriture quotidienne',
    body: 'L’onglet Écriture est votre poste principal : texte, point de vue, statut, personnages présents, résumé interne.',
    bullets: [
      'Le compteur de mots est mis à jour automatiquement',
      'Le mode focus masque le bruit visuel',
      'Le panneau droit ouvre IA + thésaurus',
    ],
  },
  {
    title: '4 — Correcteur : philosophie',
    body: 'Le correcteur est discret par défaut : vous gardez la main. Les analyses plus profondes se font au moment choisi, pas en vous interrompant.',
    bullets: [
      'Simple / Simple strict / Expert selon votre style',
      'Analyser lance une passe complète contextualisée',
      'Le mode Expert affiche les niveaux de confiance',
    ],
  },
  {
    title: '5 — Corrections et journal',
    body: 'Les corrections silencieuses restent traçables : vous pouvez contrôler, annuler et rejouer les modifications appliquées.',
    bullets: [
      'Journal des silencieuses (icône plume)',
      'Ctrl+Alt+Z annule, Ctrl+Alt+Y rétablit',
      'Vous pouvez masquer les suggestions obsolètes',
    ],
  },
  {
    title: '6 — Bible, personnages, chronologie',
    body: 'Ces onglets construisent la cohérence de votre univers. Plus ils sont à jour, plus les outils IA/correcteur deviennent utiles.',
    bullets: [
      'Bible : lore, règles, lieux, factions',
      'Personnages : fiches complètes et relations implicites',
      'Chronologie : repère les incohérences temporelles',
    ],
  },
  {
    title: '7 — Carte du monde',
    body: 'L’onglet Carte centralise image globale + lieux. Vous pouvez aussi utiliser le questionnaire avancé pour générer un superprompt de carte IA.',
    bullets: [
      'Carte globale + fiches de lieux',
      'Questionnaire complet (géographie, échelle, biomes)',
      'Superprompt prêt à coller dans un générateur d’images',
    ],
  },
  {
    title: '8 — STUDIO ROMAN IA',
    body: 'Les outils IA (fiche de reprise, carte, défis, style) passent par le backend local. Vérifiez sa disponibilité en cas de message d’erreur.',
    bullets: [
      'Backend Java requis pour les modules IA',
      'Ollama local possible pour une IA sans abonnement',
      'Les messages d’erreur indiquent quoi relancer',
    ],
  },
  {
    title: '9 — Sauvegarde en 3 niveaux',
    body: 'La sécurité des manuscrits est prioritaire : sauvegarde locale navigateur/desktop, cloud, puis exports fichiers datés.',
    bullets: [
      'Niveau 1 : stockage local instantané',
      'Niveau 2 : Google Drive / Dropbox périodique',
      'Niveau 3 : export JSON sur disque (recommandé)',
    ],
  },
  {
    title: '10 — Dropbox et connexion Google',
    body: 'Dans l’app desktop, la connexion Dropbox peut s’ouvrir dans le navigateur système pour fiabiliser “Se connecter avec Google”.',
    bullets: [
      'Ajoutez les URI de redirection requises dans Dropbox',
      'Le guide détaille les cas 5173 / 14230 / 127.0.0.1:17863',
      'En cas de doute, suivez le tutoriel Dropbox du Guide',
    ],
  },
  {
    title: '11 — Export, import, récupération',
    body: 'Avant un changement majeur, exportez. En cas de souci, importez un backup JSON récent pour repartir rapidement.',
    bullets: [
      'Export manuscrit: DOCX / PDF / EPUB',
      'Import texte possible en créant une nouvelle structure',
      'Le backup JSON reste votre parachute principal',
    ],
  },
  {
    title: '12 — Personnaliser votre usage',
    body: 'Vous pouvez adapter Scriptor à votre méthode : options .env, mode IA, niveau d’assistance, style de correction.',
    bullets: [
      'Réglez ce qui vous aide réellement',
      'Ignorez ce qui vous distrait',
      'Scriptor doit servir votre flux, pas l’inverse',
    ],
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
          Bienvenue — Studio Roman
        </h2>
        <p className="corrector-onboarding-step">{s.title}</p>
        <p className="corrector-onboarding-body">{s.body}</p>
        {Array.isArray(s.bullets) && s.bullets.length ? (
          <ul className="corrector-onboarding-list">
            {s.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
        {step === 0 && (
          <p className="corrector-onboarding-hint">
            Astuce : passez sur l’onglet <strong>Écriture</strong> dès maintenant pour suivre la visite en contexte.
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
          Étape {step + 1} / {STEPS.length} — rejouer depuis <strong>Guide</strong>. Fermer marque ce didacticiel comme vu.
        </p>
      </div>
    </div>
  )
}
