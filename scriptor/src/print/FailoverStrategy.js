/**
 * Stratégies dégradées (CDC Brique 4) — l’export ou le flux continue toujours.
 *
 * - **GSUB/GPOS** : `gsubGposCorrupt` conserve le glyphe de base sans lookups avancés (opentype.js).
 * - **Font outlined** : `fontOutlineFailed` bascule vers du texte embedded standard.
 */
export const FAILOVER_LABELS = {
  colorNotCertified: 'Couleur non certifiée',
  validationSkipped: 'Validation non effectuée',
  saliencyFallback: 'Placement heuristique utilisé',
}

/**
 * Chaque handler retourne un plan degrade exploitable immediatement,
 * pour garantir "jamais bloque".
 */
export function createFailoverStrategy() {
  return {
    littleCmsCrash(err) {
      return {
        component: 'LittleCMS',
        degraded: true,
        steps: ['littlecms-native', 'littlecms-wasm', 'canvas-simulated'],
        selected: 'littlecms-wasm',
        userLabel: FAILOVER_LABELS.colorNotCertified,
        userMessage:
          'Le moteur colorimetrique natif a echoue. Bascule automatique en mode degrade.',
        techMessage: String(err?.message || err || 'littlecms-native-crash'),
      }
    },

    littleCmsWasmCrash(err) {
      return {
        component: 'LittleCMS',
        degraded: true,
        steps: ['canvas-simulated'],
        selected: 'canvas-simulated',
        userLabel: FAILOVER_LABELS.colorNotCertified,
        userMessage:
          'Conversion ICC indisponible. Simulation Canvas activee (non certifiee impression).',
        techMessage: String(err?.message || err || 'littlecms-wasm-crash'),
      }
    },

    validationToolMissing(err) {
      return {
        component: 'veraPDF/Ghostscript',
        degraded: true,
        selected: 'export-without-validation',
        userLabel: FAILOVER_LABELS.validationSkipped,
        userMessage:
          'Validation PDF/X indisponible localement. Export poursuivi sans validation automatique.',
        techMessage: String(err?.message || err || 'validation-binary-missing'),
      }
    },

    saliencyDivergence(err) {
      return {
        component: 'TensorFlow.js saliency',
        degraded: true,
        selected: 'edge-variance-heuristic',
        userLabel: FAILOVER_LABELS.saliencyFallback,
        userMessage:
          "Le modele de saliency diverge. Bascule en heuristique contour+variance et information de l'auteur.",
        techMessage: String(err?.message || err || 'saliency-divergence'),
      }
    },

    gsubGposCorrupt(err) {
      return {
        component: 'opentype.js GSUB/GPOS',
        degraded: true,
        selected: 'base-glyph-untransformed',
        userMessage:
          'Certaines tables OpenType sont invalides. Le glyphe de base est conserve sans transformation.',
        techMessage: String(err?.message || err || 'gsub-gpos-corrupt'),
      }
    },

    fontOutlineFailed(err) {
      return {
        component: 'font outlining',
        degraded: true,
        selected: 'embedded-standard',
        userMessage:
          "Le mode outlined a echoue. Export bascule en mode embedded standard pour garantir la livraison.",
        techMessage: String(err?.message || err || 'font-outline-failed'),
      }
    },

    pollinationsOffline(err) {
      return {
        component: 'Pollinations.ai',
        degraded: true,
        selected: 'pause-task-queue',
        pauseQueue: true,
        keepPromptInMemory: true,
        autoResumeOnOnline: true,
        userMessage:
          'Connexion perdue vers le moteur image. Tache mise en pause puis reprise automatique au retour reseau.',
        techMessage: String(err?.message || err || 'pollinations-offline'),
      }
    },
  }
}

export const failoverStrategy = createFailoverStrategy()

