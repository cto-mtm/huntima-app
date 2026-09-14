const en = {
  title: 'Your organizations',
  empty: 'This account doesn’t run an organization yet. Start one below.',
  loadFailed: 'Could not load your organizations.',
  open: 'Open console',
  view: 'View fan page',
  platformHome: 'Huntima home',
  role: {
    owner: 'Owner',
    editor: 'Editor',
    operator: 'Operator',
  },

  // The create-an-org form (components/CreateOrgForm.vue), shared by this page
  // and the consumer home.
  runTitle: 'Run a hunt',
  openHeading: 'Open a console',
  yoursLabel: 'Yours',

  // Starting a hunt: the common path. Never says "organization" — see
  // components/CreateHuntForm.vue.
  startHuntHeading: 'Start a hunt',
  startHuntIntro: 'For a wedding, a party, a class, a team day. Name it and add your photo missions.',
  huntNameLabel: 'What’s it called?',
  huntNamePlaceholder: 'e.g. Sarah & Tom’s Wedding',
  startHunt: 'Start the hunt',
  startingHunt: 'Starting…',
  chooseAddress: 'Choose your web address',
  addressLabel: 'Your web address',
  addressHelp: 'Your page lives here. It’s per account, not per hunt, and can’t be changed later.',
  addressSettled: 'Your hunts live at {url}',

  // Organizations: the deliberate, rarer path.
  createPrompt: 'Setting up for a club, company or venue?',
  createHeading: 'Create an organization',
  createIntro: 'A branded page with your own name in the address, plus a team who can run it.',
  nameLabel: 'Organization name',
  namePlaceholder: 'e.g. Louisville Bats',
  slugLabel: 'Web address',
  slugHelp: 'Fans open this address, or scan it as a QR code. It can’t be changed later.',
  create: 'Create organization',
  creating: 'Creating…',
  createFailed: 'Could not create it. Try again.',
  createRateLimited: 'That’s the limit of new organizations for today.',
  createNotAllowed: 'This account isn’t allowed to create organizations here.',
  slug: {
    checking: 'Checking…',
    free: 'Available.',
    taken: 'Taken — try another address.',
    reserved: 'That word is reserved by the platform.',
    format: 'Use 3–50 lowercase letters, numbers or hyphens.',
    unknown: 'Couldn’t check this address — creating it will confirm.',
  },
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Tus organizaciones',
  empty: 'Esta cuenta todavía no gestiona ninguna organización. Crea una abajo.',
  loadFailed: 'No se pudieron cargar tus organizaciones.',
  open: 'Abrir consola',
  view: 'Ver página de fans',
  platformHome: 'Inicio de Huntima',
  role: {
    owner: 'Propietario',
    editor: 'Editor',
    operator: 'Operador',
  },

  runTitle: 'Organizar una búsqueda',
  openHeading: 'Abrir una consola',
  yoursLabel: 'Tuya',

  startHuntHeading: 'Crear una búsqueda',
  startHuntIntro: 'Para una boda, una fiesta, una clase o un día de equipo. Ponle nombre y añade tus misiones.',
  huntNameLabel: '¿Cómo se llama?',
  huntNamePlaceholder: 'ej. La boda de Sara y Tomás',
  startHunt: 'Crear la búsqueda',
  startingHunt: 'Creando…',
  chooseAddress: 'Elige tu dirección web',
  addressLabel: 'Tu dirección web',
  addressHelp: 'Aquí vive tu página. Es por cuenta, no por búsqueda, y no se puede cambiar después.',
  addressSettled: 'Tus búsquedas están en {url}',

  createPrompt: '¿Es para un club, una empresa o un recinto?',
  createHeading: 'Crear una organización',
  createIntro: 'Una página con tu marca y tu propio nombre en la dirección, más un equipo que la gestione.',
  nameLabel: 'Nombre de la organización',
  namePlaceholder: 'ej. Louisville Bats',
  slugLabel: 'Dirección web',
  slugHelp: 'Los aficionados abren esta dirección o escanean su código QR. No se puede cambiar después.',
  create: 'Crear organización',
  creating: 'Creando…',
  createFailed: 'No se pudo crear. Inténtalo de nuevo.',
  createRateLimited: 'Has alcanzado el límite de organizaciones nuevas por hoy.',
  createNotAllowed: 'Esta cuenta no tiene permiso para crear organizaciones aquí.',
  slug: {
    checking: 'Comprobando…',
    free: 'Disponible.',
    taken: 'Ya está en uso. Prueba otra dirección.',
    reserved: 'Esa palabra está reservada por la plataforma.',
    format: 'Usa de 3 a 50 letras minúsculas, números o guiones.',
    unknown: 'No se pudo comprobar la dirección. Al crearla se confirmará.',
  },
}

export default { en, es }
