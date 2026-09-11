const en = {
  navMissions: 'Missions',
  navTrophies: 'Trophies',
  navPrize: 'Prize',
  navAbout: 'About',
  localeLabel: 'Language',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  navMissions: 'Misiones',
  navTrophies: 'Trofeos',
  navPrize: 'Premio',
  navAbout: 'Acerca de',
  localeLabel: 'Idioma',
}

export default { en, es }
