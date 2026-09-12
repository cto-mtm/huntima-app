const en = {
  lockedTitle: 'Not yet!',
  lockedBody: 'Finish the hunt to unlock your prize — {remaining} more badge(s) to go.',
  wonTitle: 'You did it, {nickname}!',
  wonBody: 'Show this screen at {location} to claim your prize.',
  pinLabel: 'Your claim code',
  prizeHeading: 'Your prize',
  prizeUpForGrabs: "What you're playing for",
  prizeWinners: 'Limited to {count} winners',
  redeemedTitle: 'Already claimed',
  redeemedBody: 'This code has been redeemed. One prize per hunter.',
  backToMissions: 'Back to missions',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  lockedTitle: '¡Todavía no!',
  lockedBody: 'Termina la búsqueda para desbloquear tu premio: te faltan {remaining} insignia(s).',
  wonTitle: '¡Lo lograste, {nickname}!',
  wonBody: 'Muestra esta pantalla en {location} para reclamar tu premio.',
  pinLabel: 'Tu código de canje',
  prizeHeading: 'Tu premio',
  prizeUpForGrabs: 'Por lo que estás jugando',
  prizeWinners: 'Limitado a {count} ganadores',
  redeemedTitle: 'Ya canjeado',
  redeemedBody: 'Este código ya fue canjeado. Un premio por participante.',
  backToMissions: 'Volver a las misiones',
}

export default { en, es }
