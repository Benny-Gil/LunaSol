import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import NotificationBell from './NotificationBell';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock @clerk/nextjs
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    user: {
      publicMetadata: {
        role: 'patient',
      },
    },
  }),
}));

// Mock useNotifications hook
const mockMarkRead = vi.fn();
const mockUseNotifications = vi.fn();
vi.mock('@/lib/useNotifications', () => ({
  useNotifications: () => mockUseNotifications(),
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the bell button', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      markRead: mockMarkRead,
    });

    render(<NotificationBell />);
    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toBeInTheDocument();
  });

  it('should display the unread count badge when count is greater than 0', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [
        { id: '1', type: 'APPOINTMENT_CREATED', message: 'Appointment booked', isRead: false, createdAt: new Date().toISOString() },
      ],
      unreadCount: 1,
      markRead: mockMarkRead,
    });

    render(<NotificationBell />);
    const badge = screen.getByText('1');
    expect(badge).toBeInTheDocument();
  });

  it('should show "No notifications yet" when clicking the bell with an empty list', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      markRead: mockMarkRead,
    });

    render(<NotificationBell />);
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });

  it('should show notifications and call markRead when a notification is clicked', async () => {
    const mockNotifications = [
      { id: '1', type: 'APPOINTMENT_CREATED', message: 'New booking', isRead: false, createdAt: new Date().toISOString() },
    ];
    mockUseNotifications.mockReturnValue({
      notifications: mockNotifications,
      unreadCount: 1,
      markRead: mockMarkRead,
    });

    render(<NotificationBell />);
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    const notificationItem = screen.getByText('New booking');
    expect(notificationItem).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(notificationItem);
    });
    expect(mockMarkRead).toHaveBeenCalledWith('1');
  });
});
