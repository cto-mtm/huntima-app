// Cross-cutting vocabulary used by more than one feature.
// If a string is only used in one place, it belongs in that feature's module.

const en = {
  guest: 'Guest',
  loading: 'Loading…',
  error: 'Something went wrong.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  guest: 'Invitado',
  loading: 'Cargando…',
  error: 'Algo salió mal.',
}

export default { en, es }
