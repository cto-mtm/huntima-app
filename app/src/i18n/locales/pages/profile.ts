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
  signedInAs: 'Sesión iniciada como {email}',
  guestNotice: 'Estás jugando como invitado en este dispositivo. Tus insignias se quedan en este teléfono.',
  signIn: 'Inicia sesión o crea una cuenta',
  signOut: 'Cerrar sesión',
}

export default { en, es }
