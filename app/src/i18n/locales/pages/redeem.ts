const en = {
  lockedTitle: 'Your prize',
  lockedBody: 'Finish the hunt to unlock it — {remaining} more badge(s) to go.',
  // Shown in the locked state when the hunt has no prize configured: the
  // reward IS finishing the hunt, so the trophy stands in for a prize card.
  noPrizeTitle: 'Finish the hunt',
  noPrizeBody: 'Collect every badge to complete the hunt — {remaining} more to go.',
  // The always-present call to action on the locked screen, under the trophy.
  keepPlaying: 'Keep playing to redeem →',
  wonTitle: 'You did it, {nickname}!',
  wonBody: 'Show this screen at {location} to claim your prize.',
  pinLabel: 'Your claim code',
  prizeHeading: 'Your prize',
  prizeUpForGrabs: "What you're playing for",
  prizeWinners: 'Limited to {count} winners',
  redeemedTitle: 'Already claimed',
  redeemedBody: 'This code has been redeemed. One prize per hunter.',
  backToMissions: 'Back to missions',
  // The badge case: one slot per mission in this hunt. `caseLocked` labels a
  // slot whose mission has not been captured — deliberately says nothing
  // about WHICH mission it is.
  caseHeading: 'Your badge case',
  caseCount: '{count} of {total}',
  caseLocked: 'Locked',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  lockedTitle: 'Tu premio',
  lockedBody: 'Termina la búsqueda para desbloquearlo: te faltan {remaining} insignia(s).',
  noPrizeTitle: 'Termina la búsqueda',
  noPrizeBody: 'Consigue todas las insignias para completar la búsqueda: te faltan {remaining}.',
  keepPlaying: 'Sigue jugando para canjear →',
  wonTitle: '¡Lo lograste, {nickname}!',
  wonBody: 'Muestra esta pantalla en {location} para reclamar tu premio.',
  pinLabel: 'Tu código de canje',
  prizeHeading: 'Tu premio',
  prizeUpForGrabs: 'Por lo que estás jugando',
  prizeWinners: 'Limitado a {count} ganadores',
  redeemedTitle: 'Ya canjeado',
  redeemedBody: 'Este código ya fue canjeado. Un premio por participante.',
  backToMissions: 'Volver a las misiones',
  caseHeading: 'Tu vitrina de insignias',
  caseCount: '{count} de {total}',
  caseLocked: 'Bloqueada',
}

export default { en, es }
