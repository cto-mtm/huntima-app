const en = {
  ongoingHeading: 'Your ongoing hunts',
  ongoingEmpty: 'No hunts in progress. Scan an event’s QR code to jump in.',
  badgeProgress: '{count} / {target} badges',
  continue: 'Continue',

  // The one organizer affordance on the player's home. Plain words on
  // purpose: "console" and "organization" are the vocabulary of the screen
  // it leads to, not of someone who came here to play.
  organizerLink: 'Run your own hunt →',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  ongoingHeading: 'Tus búsquedas en curso',
  ongoingEmpty: 'No tienes búsquedas en curso. Escanea el código QR de un evento para empezar.',
  badgeProgress: '{count} / {target} insignias',
  continue: 'Continuar',

  organizerLink: 'Crea tu propia búsqueda →',
}

export default { en, es }
