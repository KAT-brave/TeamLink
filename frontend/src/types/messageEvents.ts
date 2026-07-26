import type { Message, MessageUser } from '../api/messages'

// broadcast ペイロードには can_edit, can_delete が含まれない
export type BroadcastMessage = Omit<Message, 'can_edit' | 'can_delete'> & {
  user: MessageUser
}

export type MessageCreatedEvent = {
  type: 'message_created'
  message: BroadcastMessage
  channel_id: number
}

export type MessageUpdatedEvent = {
  type: 'message_updated'
  message: BroadcastMessage
  channel_id: number
}

export type MessageDeletedEvent = {
  type: 'message_deleted'
  message_id: number
  channel_id: number
}

export type MessageEvent = MessageCreatedEvent | MessageUpdatedEvent | MessageDeletedEvent

export function isMessageCreatedEvent(data: unknown): data is MessageCreatedEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === 'message_created' &&
    typeof (data as Record<string, unknown>).message === 'object' &&
    typeof (data as Record<string, unknown>).channel_id === 'number'
  )
}

export function isMessageUpdatedEvent(data: unknown): data is MessageUpdatedEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === 'message_updated' &&
    typeof (data as Record<string, unknown>).message === 'object' &&
    typeof (data as Record<string, unknown>).channel_id === 'number'
  )
}

export function isMessageDeletedEvent(data: unknown): data is MessageDeletedEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === 'message_deleted' &&
    typeof (data as Record<string, unknown>).message_id === 'number' &&
    typeof (data as Record<string, unknown>).channel_id === 'number'
  )
}
