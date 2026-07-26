declare module '@rails/actioncable' {
  export interface Subscription {
    unsubscribe(): void
  }

  export interface SubscriptionHandlers {
    received?: (data: unknown) => void
    connected?: () => void
    disconnected?: () => void
    rejected?: () => void
  }

  export interface Consumer {
    subscriptions: {
      create(params: Record<string, unknown>, handlers?: SubscriptionHandlers): Subscription
    }
  }

  export function createConsumer(url: string): Consumer
}
