const en = {
  title: 'Game day',
  subtitle: 'Collect badges around the stadium and claim a prize.',

  guestHeading: 'Playing today?',
  continueAsGuest: 'Continue as guest',
  guestHelp: 'No account, no password. Your progress stays on this device.',
  continueAs: 'Continue as {nickname}',
  switchUser: 'Switch user',
  startOver: 'Start over as someone else',

  staffHeading: 'Stadium staff',
  staffSignIn: 'Staff sign-in',
  staffHelp: 'Team accounts only. Opens the campaign and branding dashboard.',

  deviceLabel: 'Device',

  loginTitle: 'Staff sign-in',
  loginSubtitle: 'Use your team account.',
  emailLabel: 'Email',
  passwordLabel: 'Password',
  signIn: 'Sign in',
  signingIn: 'Signing in…',
  signInFailed: 'Those credentials did not work.',
  notStaff: 'That account is not a staff account.',
  backToEntry: 'Back',

  signOut: 'Sign out',
  signedInAs: 'Signed in as {email}',

  devHeading: 'Dev shortcuts',
  devHelp: 'Emulator only. Jump straight to a fan progress state.',
  seedAdmin: 'Create demo admin',
  seedingAdmin: 'Creating…',
  seedAdminDone: 'Demo admin ready — credentials filled in below.',
  seedAdminFailed: 'Could not reach the emulator. Is it running?',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Día de partido',
  subtitle: 'Consigue insignias por el estadio y reclama un premio.',

  guestHeading: '¿Juegas hoy?',
  continueAsGuest: 'Entrar como invitado',
  guestHelp: 'Sin cuenta ni contraseña. Tu progreso se queda en este dispositivo.',
  continueAs: 'Continuar como {nickname}',
  switchUser: 'Cambiar de usuario',
  startOver: 'Empezar de nuevo como otra persona',

  staffHeading: 'Personal del estadio',
  staffSignIn: 'Acceso para personal',
  staffHelp: 'Solo cuentas del equipo. Abre el panel de campañas y marca.',

  deviceLabel: 'Dispositivo',

  loginTitle: 'Acceso para personal',
  loginSubtitle: 'Usa tu cuenta del equipo.',
  emailLabel: 'Correo',
  passwordLabel: 'Contraseña',
  signIn: 'Entrar',
  signingIn: 'Entrando…',
  signInFailed: 'Esas credenciales no funcionaron.',
  notStaff: 'Esa cuenta no es una cuenta del personal.',
  backToEntry: 'Volver',

  signOut: 'Cerrar sesión',
  signedInAs: 'Sesión iniciada como {email}',

  devHeading: 'Atajos de desarrollo',
  devHelp: 'Solo en el emulador. Salta directamente a un estado de progreso.',
  seedAdmin: 'Crear admin de prueba',
  seedingAdmin: 'Creando…',
  seedAdminDone: 'Admin de prueba listo: credenciales rellenadas abajo.',
  seedAdminFailed: 'No se pudo contactar con el emulador. ¿Está funcionando?',
}

export default { en, es }
