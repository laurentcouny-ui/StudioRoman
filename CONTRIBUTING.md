# Contributing

## Prerequis
- Node version: voir `scriptor/.nvmrc`
- Java: 21
- Maven: 3.9+

## Setup local
1. Installer les dependances frontend:
   - `cd scriptor`
   - `npm ci`
2. Lancer le frontend:
   - `npm run dev`
3. Lancer le backend (dans un autre terminal):
   - `cd backend`
   - `mvn "-Dskip.npm=true" spring-boot:run`

## Qualite attendue
Avant de proposer une PR:
- `cd scriptor && npm run lint`
- `cd scriptor && npm run build`
- `cd backend && mvn -q compile -DskipTests`

## Pull requests
- Une PR = un sujet clair.
- Decrire le contexte, l'impact et le plan de test.
- Ne pas inclure de secrets ni de credentials.
