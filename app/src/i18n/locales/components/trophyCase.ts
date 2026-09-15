const en = {
  title: 'Trophy case',
  progress: '{earned} of {target} badges',
  complete: 'Complete! Go claim your prize.',
  earnedHeading: 'Your trophies',
  emptyTitle: 'The case is waiting',
  empty: 'No trophies yet — win a hunt to earn one.',
  // Shown when the shelf is on screen with nothing on it. The empty shelf is
  // deliberate: it is the picture of what winning looks like.
  shelfEmptyHint: 'Win a hunt and its trophy lands here.',
  // Stat tiles. Both numbers are countable by hand from the rest of the page —
  // a stat a fan cannot verify is a stat they stop believing.
  statBadges: 'Badges earned',
  statHunts: 'Hunts won',
  // A "series" is one hunt's badge set. Slots are unnamed on purpose: a hunt
  // that is not currently loaded has no mission list on this device.
  seriesHeading: 'Your badges',
  seriesCount: '{count} of {total}',
  // The journey timeline, built from dates the app already keeps.
  journeyHeading: 'Your journey',
  journeyJoined: 'Started',
  journeyWon: 'Won',
  guestPromptTitle: 'Save your progress',
  guestPromptBody:
    "You're playing as a guest, so your trophies live only on this device. Sign in to keep them if you switch phones or clear your browser.",
  guestPromptCta: 'Sign in to save progress',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Vitrina de trofeos',
  progress: '{earned} de {target} insignias',
  complete: '¡Completo! Ve a reclamar tu premio.',
  earnedHeading: 'Tus trofeos',
  emptyTitle: 'La vitrina te espera',
  empty: 'Aún no hay trofeos: gana una búsqueda para conseguir uno.',
  shelfEmptyHint: 'Gana una búsqueda y su trofeo aparecerá aquí.',
  statBadges: 'Insignias ganadas',
  statHunts: 'Búsquedas ganadas',
  seriesHeading: 'Tus insignias',
  seriesCount: '{count} de {total}',
  journeyHeading: 'Tu recorrido',
  journeyJoined: 'Empezaste',
  journeyWon: 'Ganaste',
  guestPromptTitle: 'Guarda tu progreso',
  guestPromptBody:
    'Estás jugando como invitado, así que tus trofeos solo existen en este dispositivo. Inicia sesión para conservarlos si cambias de teléfono o borras tu navegador.',
  guestPromptCta: 'Inicia sesión para guardar tu progreso',
}

export default { en, es }
