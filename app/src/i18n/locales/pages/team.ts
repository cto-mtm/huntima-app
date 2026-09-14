const en = {
  title: 'Team',
  subtitle: 'Who can open this console.',
  loadFailed: 'Could not load the team.',

  you: '(you)',
  noEmail: 'Account removed',

  addHeading: 'Add a teammate',
  addHelp: 'They need a Huntima account already, using this email address.',
  emailLabel: 'Their email',
  roleLabel: 'Role',
  roleHelp: 'Editors manage branding and hunts. Owners also manage the team.',
  add: 'Add',
  adding: 'Adding…',
  addNoAccount: 'No Huntima account uses that email. Ask them to sign up first.',
  addFailed: 'Could not add them. Try again.',

  remove: 'Remove',
  removeConfirm: 'Remove {who} from this organization?',
  removeLastOwner: 'An organization needs at least one owner.',
  removeFailed: 'Could not remove them. Try again.',

  ownerOnly: 'Only an owner can change the team.',
  ownerOnlyNotice: 'Only an owner can add or remove people.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Equipo',
  subtitle: 'Quién puede abrir esta consola.',
  loadFailed: 'No se pudo cargar el equipo.',

  you: '(tú)',
  noEmail: 'Cuenta eliminada',

  addHeading: 'Añadir a alguien',
  addHelp: 'Necesitan tener ya una cuenta de Huntima con este correo.',
  emailLabel: 'Su correo',
  roleLabel: 'Rol',
  roleHelp: 'Los editores gestionan la marca y las búsquedas. Los propietarios también gestionan el equipo.',
  add: 'Añadir',
  adding: 'Añadiendo…',
  addNoAccount: 'Ninguna cuenta de Huntima usa ese correo. Pídeles que se registren primero.',
  addFailed: 'No se pudo añadir. Inténtalo de nuevo.',

  remove: 'Quitar',
  removeConfirm: '¿Quitar a {who} de esta organización?',
  removeLastOwner: 'Una organización necesita al menos un propietario.',
  removeFailed: 'No se pudo quitar. Inténtalo de nuevo.',

  ownerOnly: 'Solo un propietario puede cambiar el equipo.',
  ownerOnlyNotice: 'Solo un propietario puede añadir o quitar personas.',
}

export default { en, es }
