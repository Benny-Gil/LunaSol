import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { verifyToken } from '@clerk/backend'
import { PrismaService } from '../prisma/prisma.service'

@WebSocketGateway({ cors: { origin: '*' }, path: '/api/socket.io' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined

    if (!token) {
      client.disconnect()
      return
    }

    try {
      const decoded = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
      const clerkId = decoded.sub

      const user = await this.prisma.user.findUnique({ where: { clerkId } })
      if (!user) {
        client.disconnect()
        return
      }

      client.data.userId = user.id
      client.join(user.id)
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(_client: Socket) {}
}
