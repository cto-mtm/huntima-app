const en = {
  title: 'Welcome to the hunt',
  subtitle: 'Pick a name and a look. No account, no password.',
  nicknameLabel: 'Your nickname',
  nicknamePlaceholder: 'e.g. FastPitch99',
  nicknameTooShort: 'Pick at least 2 characters.',
  avatarLabel: 'Choose your avatar',
  start: 'Start hunting',
  privacyNote: 'Your nickname stays on this device. We never ask for anything else.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Bienvenido a la búsqueda',
  subtitle: 'Elige un nombre y un estilo. Sin cuenta, sin contraseña.',
  nicknameLabel: 'Tu apodo',
  nicknamePlaceholder: 'ej. FastPitch99',
  nicknameTooShort: 'Elige al menos 2 caracteres.',
  avatarLabel: 'Elige tu avatar',
  start: 'Empezar',
  privacyNote: 'Tu apodo se queda en este dispositivo. Nunca pedimos nada más.',
}

export default { en, es }
