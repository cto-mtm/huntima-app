const en = {
  title: 'Trophy case',
  progress: '{earned} of {target} badges',
  complete: 'Complete! Go claim your prize.',
  earnedHeading: 'Your trophies',
  wonOn: 'Won {date}',
  empty: 'No trophies yet — win a hunt to earn one.',
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
  wonOn: 'Ganado el {date}',
  empty: 'Aún no hay trofeos: gana una búsqueda para conseguir uno.',
  guestPromptTitle: 'Guarda tu progreso',
  guestPromptBody:
    'Estás jugando como invitado, así que tus trofeos solo existen en este dispositivo. Inicia sesión para conservarlos si cambias de teléfono o borras tu navegador.',
  guestPromptCta: 'Inicia sesión para guardar tu progreso',
}

export default { en, es }
