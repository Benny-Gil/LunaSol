import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsGateway } from './notifications.gateway'

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
  ) {}

  emitToUser(userId: string, event: string, payload: object) {
    this.gateway.server?.to(userId).emit(event, payload)
  }

  async findForUser(clerkId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    return this.prisma.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async markRead(clerkId: string, notificationId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    })
    if (!notification) throw new NotFoundException('Notification not found')
    if (notification.recipientId !== user.id) throw new ForbiddenException('Not your notification')

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    })
  }
}
