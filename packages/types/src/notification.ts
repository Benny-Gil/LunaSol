export interface Notification {
  id: string
  recipientId: string
  type: string
  message: string
  isRead: boolean
  createdAt: string
}
