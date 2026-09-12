const en = {
  title: 'Game day',
  subtitle: 'Collect badges around the stadium and claim a prize.',

  guestHeading: 'Playing today?',
  continueAsGuest: 'Continue as guest',
  guestHint: 'No account needed. Your badges stay on this phone.',
  or: 'or',
  signInGoogle: 'Continue with Google',
  signInEmail: 'Use email instead',
  haveAccount: 'Already have an account?',
  accountHeading: 'Save your progress',
  accountHelp: 'An account keeps your name across visits.',
  guestHelp: 'No account, no password. Your progress stays on this device.',
  continueAs: 'Continue as {nickname}',
  switchUser: 'Switch user',
  startOver: 'Start over as someone else',

  staffSignIn: 'Staff sign-in',

  deviceLabel: 'Device',

  fanSignInTitle: 'Sign in',
  fanSignUpTitle: 'Create an account',
  toggleToSignUp: 'Create one',
  toggleToSignIn: 'Sign in instead',
  createAccount: 'Create account',
  passwordTooShort: 'Use at least 6 characters.',
  emailInUse: 'That email already has an account.',

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
  guestHint: 'Sin cuenta. Tus insignias se quedan en este teléfono.',
  or: 'o',
  signInGoogle: 'Continuar con Google',
  signInEmail: 'Usar correo electrónico',
  haveAccount: '¿Ya tienes una cuenta?',
  accountHeading: 'Guarda tu progreso',
  accountHelp: 'Una cuenta conserva tu nombre entre visitas.',
  guestHelp: 'Sin cuenta ni contraseña. Tu progreso se queda en este dispositivo.',
  continueAs: 'Continuar como {nickname}',
  switchUser: 'Cambiar de usuario',
  startOver: 'Empezar de nuevo como otra persona',

  staffSignIn: 'Acceso para personal',

  deviceLabel: 'Dispositivo',

  fanSignInTitle: 'Iniciar sesión',
  fanSignUpTitle: 'Crear una cuenta',
  toggleToSignUp: 'Crear una',
  toggleToSignIn: 'Iniciar sesión',
  createAccount: 'Crear cuenta',
  passwordTooShort: 'Usa al menos 6 caracteres.',
  emailInUse: 'Ese correo ya tiene una cuenta.',

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
