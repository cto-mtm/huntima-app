const en = {
  title: 'Game day',
  subtitle: 'Collect badges around the stadium and claim a prize.',

  guestHeading: 'Playing today?',
  continueAsGuest: 'Continue as guest',
  guestHelp: 'No account, no password. Your progress stays on this device.',
  continueAs: 'Continue as {nickname}',
  switchUser: 'Switch user',
  startOver: 'Start over as someone else',

  staffSignIn: 'Staff sign-in',

  deviceLabel: 'Device',

  loginTitle: 'Staff sign-in',
  loginSubtitle: 'Use your team account.',
  emailLabel: 'Email',
  passwordLabel: 'Password',
  signIn: 'Sign in',
  signingIn: 'Signing in…',
  signInFailed: 'Those credentials did not work.',
  signInUnavailable: 'Could not reach the sign-in service. Check the emulator is running.',
  notStaff: 'That account is not a staff account.',
  backToEntry: 'Back',

  signOut: 'Sign out',
  signedInAs: 'Signed in as {email}',

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

  staffSignIn: 'Acceso para personal',

  deviceLabel: 'Dispositivo',

  loginTitle: 'Acceso para personal',
  loginSubtitle: 'Usa tu cuenta del equipo.',
  emailLabel: 'Correo',
  passwordLabel: 'Contraseña',
  signIn: 'Entrar',
  signingIn: 'Entrando…',
  signInFailed: 'Esas credenciales no funcionaron.',
  signInUnavailable: 'No se pudo contactar con el servicio de acceso. Comprueba que el emulador esté funcionando.',
  notStaff: 'Esa cuenta no es una cuenta del personal.',
  backToEntry: 'Volver',

  signOut: 'Cerrar sesión',
  signedInAs: 'Sesión iniciada como {email}',

}

export default { en, es }
