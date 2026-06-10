export const SUPPORT = {
  title: 'Soutenir Soundy',
  intro:
    'Soundy est un projet indie autour de l’écoute partagée — salons, lives et carte. Un petit coup de pouce aide à faire vivre l’app et à la faire grandir.',
  demoNote: 'Mode démo (msdev) : simulation de pourboire, aucun paiement réel ni carte.',
  amounts: [3, 5, 10] as const,
  thankYou: (amount: number) => `Merci pour votre soutien symbolique de ${amount} € ! 💜`,
  externalPaymentLabel: 'Paiement en ligne',
  externalPaymentHint: 'Stripe / Ko-fi',
  externalPaymentSoon: 'Bientôt disponible',
  shareLabel: 'Partager l’app',
  copyLabel: 'Copier le lien',
  shareCopied: 'Lien copié — merci de faire passer le mot !',
  shareShared: 'Merci pour le partage !',
  profileTeaser: 'Aider le projet à grandir',
  clickCount: (n: number) =>
    n === 1 ? '1 geste de soutien enregistré (démo)' : `${n} gestes de soutien enregistrés (démo)`,
} as const;
