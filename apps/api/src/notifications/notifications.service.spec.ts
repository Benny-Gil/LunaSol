import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;
  let gateway: NotificationsGateway;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockGateway = {
    server: {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);
    gateway = module.get<NotificationsGateway>(NotificationsGateway);

    jest.clearAllMocks();
  });

  describe('emitToUser', () => {
    it('should emit the event to the user room', () => {
      const userId = 'user-123';
      const event = 'test-event';
      const payload = { data: 'hello' };

      service.emitToUser(userId, event, payload);

      expect(gateway.server?.to).toHaveBeenCalledWith(userId);
      expect(gateway.server?.to(userId).emit).toHaveBeenCalledWith(event, payload);
    });
  });

  describe('findForUser', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findForUser('clerk-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return user notifications', async () => {
      const mockUser = { id: 'db-user-123', clerkId: 'clerk-123' };
      const mockNotifications = [
        { id: 'notif-1', recipientId: 'db-user-123', message: 'Hello' },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.notification.findMany.mockResolvedValue(mockNotifications);

      const result = await service.findForUser('clerk-123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: 'clerk-123' },
      });
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { recipientId: 'db-user-123' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('markRead', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.markRead('clerk-123', 'notif-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if notification does not exist', async () => {
      const mockUser = { id: 'db-user-123', clerkId: 'clerk-123' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.notification.findUnique.mockResolvedValue(null);

      await expect(service.markRead('clerk-123', 'notif-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if notification belongs to another user', async () => {
      const mockUser = { id: 'db-user-123', clerkId: 'clerk-123' };
      const mockNotification = { id: 'notif-1', recipientId: 'db-user-999' };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.notification.findUnique.mockResolvedValue(mockNotification);

      await expect(service.markRead('clerk-123', 'notif-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should update the notification isRead to true', async () => {
      const mockUser = { id: 'db-user-123', clerkId: 'clerk-123' };
      const mockNotification = { id: 'notif-1', recipientId: 'db-user-123', isRead: false };
      const mockUpdated = { ...mockNotification, isRead: true };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.notification.findUnique.mockResolvedValue(mockNotification);
      mockPrismaService.notification.update.mockResolvedValue(mockUpdated);

      const result = await service.markRead('clerk-123', 'notif-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      });
      expect(result).toEqual(mockUpdated);
    });
  });
});
