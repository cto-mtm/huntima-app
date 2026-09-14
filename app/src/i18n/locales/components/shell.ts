const en = {
  // The product name is a brand mark, identical in every locale — but it is
  // rendered copy, so it lives here rather than hardcoded in the template.
  wordmark: 'Huntima',
  navHome: 'Home',
  navHuntima: 'Huntima',
  navMissions: 'Missions',
  navTrophies: 'Trophies',
  navPrize: 'Prize',
  navAbout: 'About',
  navProfile: 'Profile',
  localeLabel: 'Language',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  wordmark: 'Huntima',
  navHome: 'Inicio',
  navHuntima: 'Huntima',
  navMissions: 'Misiones',
  navTrophies: 'Trofeos',
  navPrize: 'Premio',
  navAbout: 'Acerca de',
  navProfile: 'Perfil',
  localeLabel: 'Idioma',
}

export default { en, es }
