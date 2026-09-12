const en = {
  title: 'Branding',
  subtitle: 'Set the team identity and palette. Changes apply instantly.',
  backToApp: 'Back to the fan app',

  identityHeading: 'Identity',
  teamNameLabel: 'Team name',
  teamNameHelp: 'Shown in the app header and on the entry screen.',
  prizeLocationLabel: 'Prize pickup location',
  prizeLocationHelp: 'Where a winner goes to claim. Appears on the redeem screen.',
  badgeTargetLabel: 'Default badge target',
  badgeTargetHelp: 'Used until the campaign loads. The campaign then wins.',

  paletteHeading: 'Palette',
  brandLabel: 'Brand color',
  brandHelp: 'The full 50–900 ramp is derived from this one color.',
  accentLabel: 'Accent color',
  accentHelp: 'Rewards, earned badges and the win state.',
  rampLabel: 'Generated ramp',
  invalidHex: 'Enter a hex color, e.g. #2f5885.',

  contrastHeading: 'Readability',
  contrastHelp: 'This app gets used outdoors in daylight. White text on the button color must stay legible.',
  contrastOn: 'White text on {stop}',
  contrastRatio: '{ratio}:1',
  gradeAaa: 'Excellent',
  gradeAa: 'Passes',
  gradeAaLarge: 'Large text only',
  gradeFail: 'Too low — pick a darker brand color',

  logoHeading: 'Team logo',
  logoHelp: 'Shown in the app header and on the entry screen. PNG or SVG with a transparent background works best.',
  logoMissing: 'No logo',
  uploadLogo: 'Upload logo',

  avatarsHeading: 'Fan avatars',
  avatarsHelp: 'Fans pick one of these when they start. Square images, cropped to a circle.',
  avatarsEmptyNotice: 'No avatars yet. Until you add some, fans are shown the first letter of their nickname.',
  uploadAvatars: 'Upload avatars',
  removeImage: 'Remove',
  uploading: 'Uploading…',
  uploadFailed: 'Upload failed.',

  previewHeading: 'Live preview',
  previewHelp: 'The real components, re-skinned as you type.',

  reset: 'Reset to defaults',
  resetConfirm: 'Reset branding to the built-in defaults?',
  storageNote: 'Saved to this browser only. Serving branding from the API is not built yet.',
}

// Typed against en: a missing or extra key here is a compile error.
const es: typeof en = {
  title: 'Identidad de marca',
  subtitle: 'Define la identidad del equipo y la paleta. Los cambios se aplican al instante.',
  backToApp: 'Volver a la app',

  identityHeading: 'Identidad',
  teamNameLabel: 'Nombre del equipo',
  teamNameHelp: 'Aparece en la cabecera y en la pantalla de inicio.',
  prizeLocationLabel: 'Lugar de entrega del premio',
  prizeLocationHelp: 'Dónde se reclama el premio. Aparece en la pantalla de canje.',
  badgeTargetLabel: 'Insignias necesarias (por defecto)',
  badgeTargetHelp: 'Se usa hasta que carga la campaña. Después manda la campaña.',

  paletteHeading: 'Paleta',
  brandLabel: 'Color de marca',
  brandHelp: 'Toda la escala 50–900 se deriva de este color.',
  accentLabel: 'Color de acento',
  accentHelp: 'Recompensas, insignias conseguidas y pantalla de victoria.',
  rampLabel: 'Escala generada',
  invalidHex: 'Introduce un color hex, p. ej. #2f5885.',

  contrastHeading: 'Legibilidad',
  contrastHelp: 'Esta app se usa al aire libre, a plena luz. El texto blanco sobre el color del botón debe seguir siendo legible.',
  contrastOn: 'Texto blanco sobre {stop}',
  contrastRatio: '{ratio}:1',
  gradeAaa: 'Excelente',
  gradeAa: 'Correcto',
  gradeAaLarge: 'Solo texto grande',
  gradeFail: 'Insuficiente: elige un color de marca más oscuro',

  logoHeading: 'Logotipo del equipo',
  logoHelp: 'Aparece en la cabecera y en la pantalla de inicio. Mejor un PNG o SVG con fondo transparente.',
  logoMissing: 'Sin logotipo',
  uploadLogo: 'Subir logotipo',

  avatarsHeading: 'Avatares',
  avatarsHelp: 'Los aficionados eligen uno al empezar. Imágenes cuadradas, recortadas en círculo.',
  avatarsEmptyNotice: 'Aún no hay avatares. Mientras tanto, se muestra la inicial del apodo.',
  uploadAvatars: 'Subir avatares',
  removeImage: 'Quitar',
  uploading: 'Subiendo…',
  uploadFailed: 'Error al subir.',

  previewHeading: 'Vista previa',
  previewHelp: 'Los componentes reales, con la nueva marca mientras escribes.',

  reset: 'Restablecer valores por defecto',
  resetConfirm: '¿Restablecer la marca a los valores por defecto?',
  storageNote: 'Guardado solo en este navegador. Servir la marca desde la API todavía no está implementado.',
}

export default { en, es }
