import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // La quasi-totalité de la logique apptel est soit du glue-code Capacitor (natif,
    // non testable en environnement `node` sans mocks lourds), soit partagée avec
    // web/app/src (déjà couverte là-bas via le fallback Vite apptel-src-fallback).
    // `npm test` ne doit pas échouer si aucun fichier .test.ts propre à apptel
    // n'existe à un instant donné — cf. audit mobile (suppression d'un test mort
    // dupliqué qui laissait ce dossier à 0 fichier de test).
    passWithNoTests: true,
  },
});
