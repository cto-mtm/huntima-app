const en = {
  title: 'Your profile',
  subtitle: 'Pick a name and a look. Only you see this device.',

  nameLabel: 'Display name',
  namePlaceholder: 'e.g. FastPitch99',
  nameHelp: 'Shown in the app and on your prize screen. Leave it blank to stay a guest.',
  avatarLabel: 'Choose your avatar',
  avatarsEmpty: 'No avatars yet. Your initial is shown instead.',

  save: 'Save',
  saved: 'Saved.',

  accountHeading: 'Account',
  // The PLATFORM's promises, not any club's — identical at every venue,
  // which is why they live here rather than on a brand's About page.
  photosTitle: 'What happens to your photos',
  photosBody:
    'When you snap a mission photo, your phone shrinks it and removes its location data before anything leaves your device. It is sent to be checked against the mission, then discarded right away — we never save your photos or store them anywhere.',
  dataTitle: 'Your badges and progress',
  dataBody:
    'Play as a guest and your badges stay on this phone — clearing your browser data or switching phones starts you over. Sign in and your progress is saved to your account, so your trophies follow you to any device.',
  signedInAs: 'Signed in as {email}',
  guestNotice: 'Playing as a guest on this device. Your badges stay on this phone.',
  signIn: 'Sign in or create an account',
  signOut: 'Sign out',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Tu perfil',
  subtitle: 'Elige un nombre y un estilo. Solo tú ves este dispositivo.',

  nameLabel: 'Nombre visible',
  namePlaceholder: 'ej. FastPitch99',
  nameHelp: 'Aparece en la app y en tu pantalla de premio. Déjalo vacío para seguir como invitado.',
  avatarLabel: 'Elige tu avatar',
  avatarsEmpty: 'Aún no hay avatares. Se muestra tu inicial.',

  save: 'Guardar',
  saved: 'Guardado.',

  accountHeading: 'Cuenta',
  photosTitle: 'Qué pasa con tus fotos',
  photosBody:
    'Cuando haces una foto de una misión, tu teléfono la reduce y elimina sus datos de ubicación antes de que nada salga del dispositivo. Se envía para comprobarla con la misión y luego se descarta al instante: nunca guardamos tus fotos ni las almacenamos en ningún sitio.',
  dataTitle: 'Tus insignias y tu progreso',
  dataBody:
    'Si juegas como invitado, tus insignias se quedan en este teléfono: si borras los datos del navegador o cambias de teléfono, empezarás de nuevo. Si inicias sesión, tu progreso se guarda en tu cuenta y tus trofeos te acompañan en cualquier dispositivo.',
  signedInAs: 'Sesión iniciada como {email}',
  guestNotice: 'Estás jugando como invitado en este dispositivo. Tus insignias se quedan en este teléfono.',
  signIn: 'Inicia sesión o crea una cuenta',
  signOut: 'Cerrar sesión',
}

export default { en, es }
