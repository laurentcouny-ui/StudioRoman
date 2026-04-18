import emotions from './ThesaurusData/emotions.js'
import etatsPhysiques from './ThesaurusData/etatsPhysiques.js'
import traitsDeCaractere from './ThesaurusData/traitsDeCaractere.js'
import blessuresEmotionnelles from './ThesaurusData/blessuresEmotionnelles.js'
import atmospheres from './ThesaurusData/atmospheres.js'
import elementsSensoriels from './ThesaurusData/elementsSensoriels.js'
import objetsNarratifs from './ThesaurusData/objetsNarratifs.js'
import meteo from './ThesaurusData/meteo.js'
import professions from './ThesaurusData/professions.js'
import dynamiquesRelationnelles from './ThesaurusData/dynamiquesRelationnelles.js'
import motivations from './ThesaurusData/motivations.js'
import lieuxRural from './ThesaurusData/lieux_rural.js'
import lieuxUrbain from './ThesaurusData/lieux_urbain.js'
import lieuxHistoriques from './ThesaurusData/lieux.js'

import conflitsBase from './ThesaurusData/conflits.json'
import conflitsInterpersonnels from './ThesaurusData/conflits_interpersonnels.json'
import conflitsInterpersonnels2 from './ThesaurusData/conflits_interpersonnels_2.json'
import conflitsFamiliaux from './ThesaurusData/conflits_familiaux.json'
import conflitsFamiliaux2 from './ThesaurusData/conflits_familiaux_2.json'
import conflitsAmoureux from './ThesaurusData/conflits_amoureux.json'
import conflitsAmoureux2 from './ThesaurusData/conflits_amoureux_2.json'
import conflitsPouvoir from './ThesaurusData/conflits_pouvoir.json'
import conflitsPouvoir2 from './ThesaurusData/conflits_pouvoir_2.json'
import conflitsInternes from './ThesaurusData/conflits_internes.json'
import conflitsInternes2 from './ThesaurusData/conflits_internes_2.json'
import conflitsInternesBase from './ThesaurusData/conflits_internes_base.json'
import conflitsMoraux from './ThesaurusData/conflits_moraux.json'
import conflitsMoraux2 from './ThesaurusData/conflits_moraux_2.json'
import conflitsGroupe from './ThesaurusData/conflits_groupe.json'
import conflitsGroupe2 from './ThesaurusData/conflits_groupe_2.json'
import conflitsSociaux from './ThesaurusData/conflits_sociaux.json'
import conflitsExistentiels from './ThesaurusData/conflits_existentiels.json'

const conflits = [
  ...conflitsBase,
  ...conflitsInterpersonnels,
  ...conflitsInterpersonnels2,
  ...conflitsFamiliaux,
  ...conflitsFamiliaux2,
  ...conflitsAmoureux,
  ...conflitsAmoureux2,
  ...conflitsPouvoir,
  ...conflitsPouvoir2,
  ...conflitsInternes,
  ...conflitsInternes2,
  ...conflitsInternesBase,
  ...conflitsMoraux,
  ...conflitsMoraux2,
  ...conflitsGroupe,
  ...conflitsGroupe2,
  ...conflitsSociaux,
  ...conflitsExistentiels,
]

const lieux = [...lieuxHistoriques, ...lieuxRural, ...lieuxUrbain]

const thesaurusData = {
  emotions,
  etatsPhysiques,
  traitsDeCaractere,
  conflits,
  blessuresEmotionnelles,
  professions,
  lieux,
  atmospheres,
  meteo,
  elementsSensoriels,
  objetsNarratifs,
  dynamiquesRelationnelles,
  motivations,
}

export default thesaurusData
