const en = {
  title: 'About',
  body: 'A digital passport for game day. Walk the concourse, recreate the photo clues, collect badges, claim a prize.',
  healthTitle: 'API health check',
  healthNote: 'This calls GET /health on the Cloud Function. On a fresh clone it proves the emulator wiring works end to end.',
  healthOk: 'API reachable — responded at {ts}',
  healthFail: 'API unreachable: {reason}',
  check: 'Check again',
  versionLabel: 'Build',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Acerca de',
  body: 'Un pasaporte digital para el día del partido. Recorre el estadio, recrea las fotos, consigue insignias y reclama tu premio.',
  healthTitle: 'Estado de la API',
  healthNote: 'Esto llama a GET /health en la Cloud Function. En una copia nueva demuestra que el emulador está bien conectado.',
  healthOk: 'API accesible: respondió a las {ts}',
  healthFail: 'API inaccesible: {reason}',
  check: 'Comprobar de nuevo',
  versionLabel: 'Compilación',
}

export default { en, es }
