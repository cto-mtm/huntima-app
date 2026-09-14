import type { TenantAvatar } from 'shared'
import star from '../assets/avatars/star.svg'
import bolt from '../assets/avatars/bolt.svg'
import heart from '../assets/avatars/heart.svg'
import sun from '../assets/avatars/sun.svg'
import gem from '../assets/avatars/gem.svg'
import rocket from '../assets/avatars/rocket.svg'

/**
 * The platform avatar set — every fan gets these, on every org's page and on
 * the global profile, because a fan's face is CONSUMER identity, not tenant
 * content. Bundled assets: no upload, no network, work offline in a concrete
 * concourse. Orgs can still upload their own set (mascots, player photos);
 * those appear alongside these in the picker when the fan is in that org.
 *
 * Ids are namespaced `platform:*` so they can never collide with an org
 * upload's id. Progress stores the id, never the URL — same rule as tenant
 * avatars — so this set can be redrawn without reassigning anyone's face.
 *
 * The two kinds of avatar carry their name differently, and the difference is
 * real rather than cosmetic. A platform avatar is SEED DATA, so it stores an
 * i18n key and renders in the fan's language. An org's upload is
 * user-generated content, named by whoever uploaded it, and is shown verbatim
 * exactly like a fan's nickname. Same split as mission copy in `shared`
 * (`{ key }` vs `{ text }`), and the union makes "neither" unrepresentable.
 */
export interface PlatformAvatar {
  id: string
  url: string
  /** Key into the `avatars` i18n module. */
  labelKey: string
}

export type AvatarChoice = PlatformAvatar | TenantAvatar

export const PLATFORM_AVATARS: PlatformAvatar[] = [
  { id: 'platform:star', url: star, labelKey: 'avatars.star' },
  { id: 'platform:bolt', url: bolt, labelKey: 'avatars.bolt' },
  { id: 'platform:heart', url: heart, labelKey: 'avatars.heart' },
  { id: 'platform:sun', url: sun, labelKey: 'avatars.sun' },
  { id: 'platform:gem', url: gem, labelKey: 'avatars.gem' },
  { id: 'platform:rocket', url: rocket, labelKey: 'avatars.rocket' },
]

/** Resolves a platform avatar id, or null for org-uploaded (or unknown) ids. */
export function platformAvatarById(id: string | null): PlatformAvatar | null {
  if (!id) return null
  return PLATFORM_AVATARS.find((a) => a.id === id) ?? null
}

/**
 * The accessible name for either kind: translated for the platform set,
 * verbatim for an org's upload. Callers pass their own `t` rather than this
 * module reaching for the i18n singleton, so it stays a pure function.
 */
export function avatarLabel(avatar: AvatarChoice, t: (key: string) => string): string {
  return 'labelKey' in avatar ? t(avatar.labelKey) : avatar.label
}
