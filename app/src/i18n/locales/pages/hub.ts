const en = {
  greeting: 'Hey {nickname}!',
  title: 'Your missions',
  empty: 'No missions yet — check back at first pitch.',
  loadError: "Couldn't load missions. Check your connection and try again.",
  collectedHeading: 'Collected',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  greeting: '¡Hola {nickname}!',
  title: 'Tus misiones',
  empty: 'Aún no hay misiones. Vuelve en el primer lanzamiento.',
  loadError: 'No se pudieron cargar las misiones. Revisa tu conexión e inténtalo de nuevo.',
  collectedHeading: 'Conseguidas',
}

export default { en, es }
