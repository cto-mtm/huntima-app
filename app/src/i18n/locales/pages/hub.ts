const en = {
  greeting: 'Hey {nickname}!',
  title: 'Your missions',
  emptyTitle: 'Nothing to hunt yet',
  empty: 'No missions yet — check back at first pitch.',
  loadError: "Couldn't load missions. Check your connection and try again.",
  collectedHeading: 'Collected',
  progressTitle: 'Badge progress',
  progressCount: '{count} of {target}',
  oneAway: 'One away — the next badge wins it!',
  completeReady: 'Hunt complete — your prize is waiting!',
  completeClaimed: 'Hunt complete — prize claimed.',
  claimCta: 'Claim',
  startCta: 'Start hunting',
  continueCta: 'Keep hunting',
  // Levels. `moreMissions` names the unnamed remainder of a chaptered hunt —
  // never shown for a hunt with no levels at all.
  levelFound: '{count}/{total} found',
  moreMissions: 'More missions',
  // Map view
  viewLabel: 'View missions as',
  viewList: 'List',
  viewMap: 'Map',
  mapHint: 'Tap a pin to open that mission.',
  mapUnplaced: '{count} more not on the map',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  greeting: '¡Hola {nickname}!',
  title: 'Tus misiones',
  emptyTitle: 'Aún no hay nada que buscar',
  empty: 'Aún no hay misiones. Vuelve en el primer lanzamiento.',
  loadError: 'No se pudieron cargar las misiones. Revisa tu conexión e inténtalo de nuevo.',
  collectedHeading: 'Conseguidas',
  progressTitle: 'Progreso de insignias',
  progressCount: '{count} de {target}',
  oneAway: '¡Te falta solo una! La próxima insignia lo consigue.',
  completeReady: '¡Búsqueda completada! Tu premio te espera.',
  completeClaimed: 'Búsqueda completada. Premio reclamado.',
  claimCta: 'Reclamar',
  startCta: 'Empezar la búsqueda',
  continueCta: 'Seguir buscando',
  levelFound: '{count}/{total} encontradas',
  moreMissions: 'Más misiones',
  viewLabel: 'Ver misiones como',
  viewList: 'Lista',
  viewMap: 'Mapa',
  mapHint: 'Toca un pin para abrir esa misión.',
  mapUnplaced: '{count} más fuera del mapa',
}

export default { en, es }
