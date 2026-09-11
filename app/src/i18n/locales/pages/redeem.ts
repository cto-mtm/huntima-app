const en = {
  lockedTitle: 'Not yet!',
  lockedBody: 'Collect {remaining} more badge(s) to unlock your prize.',
  wonTitle: 'You did it, {nickname}!',
  wonBody: 'Show this screen at {location} to claim your prize.',
  pinLabel: 'Your claim code',
  redeemedTitle: 'Already claimed',
  redeemedBody: 'This code has been redeemed. One prize per hunter.',
  backToMissions: 'Back to missions',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  lockedTitle: '¡Todavía no!',
  lockedBody: 'Consigue {remaining} insignia(s) más para desbloquear tu premio.',
  wonTitle: '¡Lo lograste, {nickname}!',
  wonBody: 'Muestra esta pantalla en {location} para reclamar tu premio.',
  pinLabel: 'Tu código de canje',
  redeemedTitle: 'Ya canjeado',
  redeemedBody: 'Este código ya fue canjeado. Un premio por participante.',
  backToMissions: 'Volver a las misiones',
}

export default { en, es }
