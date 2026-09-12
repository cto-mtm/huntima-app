/**
 * Dev-only fan personas.
 *
 * There is no auth in this app — a "user" is a nickname, an avatar and a bag
 * of earned badges in localStorage. So "switch user" means "jump straight to
 * a progress state", which is the tedious part of testing: reaching the win
 * screen otherwise means capturing five missions by hand, every reload.
 *
 * Badge counts are resolved against the LIVE campaign target rather than
 * hardcoded, so these stay correct when the campaign changes.
 *
 * Strings here are intentionally NOT in the i18n catalog: this file is
 * eliminated from production builds, so translating it would ship two locales
 * of copy no fan can ever see. See CLAUDE.md § Dev tooling.
 */
export interface DevPersona {
  id: string
  label: string
  emoji: string
  nickname: string
  avatar: string
  /** Badges to grant, given the campaign's target. */
  badgeCount: (target: number) => number
  redeemed?: boolean
  note: string
}

export const DEV_PERSONAS: DevPersona[] = [
  {
    id: 'fresh',
    label: 'Fresh arrival',
    emoji: '🆕',
    nickname: 'NewFan01',
    avatar: '⚾',
    badgeCount: () => 0,
    note: 'Just scanned the QR code. Nothing collected.',
  },
  {
    id: 'midway',
    label: 'Halfway',
    emoji: '🚶',
    nickname: 'MidInning',
    avatar: '🧢',
    badgeCount: (target) => Math.floor(target / 2),
    note: 'Typical fan in the 4th. Trophy case partly full.',
  },
  {
    id: 'one-away',
    label: 'One away',
    emoji: '😤',
    nickname: 'SoClose',
    avatar: '🦅',
    badgeCount: (target) => Math.max(0, target - 1),
    note: 'The state that decides whether the prize feels reachable.',
  },
  {
    id: 'winner',
    label: 'Winner',
    emoji: '🏆',
    nickname: 'SluggerSam',
    avatar: '🐻',
    badgeCount: (target) => target,
    note: 'Win state unlocked. /redeem shows the claim code.',
  },
  {
    id: 'redeemed',
    label: 'Already claimed',
    emoji: '✅',
    nickname: 'PrizeTaken',
    avatar: '🚀',
    badgeCount: (target) => target,
    redeemed: true,
    note: 'Prize collected at the counter. Must not be claimable twice.',
  },
]
