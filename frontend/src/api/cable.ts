import { createConsumer, type Subscription } from '@rails/actioncable'

const cableUrl = import.meta.env.VITE_CABLE_URL ?? 'ws://localhost:3000/cable'

export const cableConsumer = createConsumer(cableUrl)

export type SubscriptionParams = {
  channel: 'MessageChannel'
  channel_id: number
}

export function subscribeToMessages(
  params: SubscriptionParams,
  handlers: {
    received?: (data: unknown) => void
    connected?: () => void
    disconnected?: () => void
    rejected?: () => void
  },
): Subscription {
  return cableConsumer.subscriptions.create(params, {
    received(data: unknown) {
      handlers.received?.(data)
    },
    connected() {
      handlers.connected?.()
    },
    disconnected() {
      handlers.disconnected?.()
    },
    rejected() {
      handlers.rejected?.()
    },
  })
}
