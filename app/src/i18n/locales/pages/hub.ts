const en = {
  greeting: 'Hey {nickname}!',
  title: 'Your missions',
  empty: 'No missions yet — check back at first pitch.',
  loadError: "Couldn't load missions. Check your connection and try again.",
  collectedHeading: 'Collected',
  progressTitle: 'Badge progress',
  progressCount: '{count} of {target}',
  oneAway: 'One away — the next badge wins it!',
  completeReady: 'Hunt complete — your prize is waiting!',
  completeClaimed: 'Hunt complete — prize claimed.',
  claimCta: 'Claim',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  greeting: '¡Hola {nickname}!',
  title: 'Tus misiones',
  empty: 'Aún no hay misiones. Vuelve en el primer lanzamiento.',
  loadError: 'No se pudieron cargar las misiones. Revisa tu conexión e inténtalo de nuevo.',
  collectedHeading: 'Conseguidas',
  progressTitle: 'Progreso de insignias',
  progressCount: '{count} de {target}',
  oneAway: '¡Te falta solo una! La próxima insignia lo consigue.',
  completeReady: '¡Búsqueda completada! Tu premio te espera.',
  completeClaimed: 'Búsqueda completada. Premio reclamado.',
  claimCta: 'Reclamar',
}

export default { en, es }
