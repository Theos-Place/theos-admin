// Types live in @/types/communication — imported here for internal use, re-exported for consumers.
import type { CommunicationChannel, CommunicationStatus, CommunicationMessage, MessageTemplate, ChannelConfig } from '@/types/communication'
export type { CommunicationChannel, CommunicationStatus, CommunicationMessage, MessageTemplate, ChannelConfig }

// ─── Channel Configs ──────────────────────────────────────────────────────────
// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getDeliveryRate(msg: CommunicationMessage): number {
  if (msg.stats.total === 0) return 0
  return Math.round((msg.stats.delivered / msg.stats.total) * 100)
}
