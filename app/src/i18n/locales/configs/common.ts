// Cross-cutting vocabulary used by more than one feature.
// If a string is only used in one place, it belongs in that feature's module.

const en = {
  guest: 'Guest',
  staffSignIn: 'Staff sign-in',
  loading: 'Loading…',
  error: 'Something went wrong.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  guest: 'Invitado',
  staffSignIn: 'Acceso para personal',
  loading: 'Cargando…',
  error: 'Algo salió mal.',
}

export default { en, es }
