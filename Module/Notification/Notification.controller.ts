import { Request, Response } from "express";
import Notification from "../../entity/Notification";
import { AuthRequest } from "../../middleware/auth.middleware";

// Get notifications for the authenticated user (unread only by default)
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { unreadOnly } = req.query;
    const filter: any = { idReceiver: userId };

    // If unreadOnly is true, only return unread notifications
    if (unreadOnly === "true") {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .populate("idSender", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(50); // Limit to 50 most recent

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount: await Notification.countDocuments({ idReceiver: userId, isRead: false }),
      },
    });
  } catch (err: unknown) {
    console.error("Get notifications error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Mark notification as read
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      res.status(404).json({
        success: false,
        message: "Notification not found",
      });
      return;
    }

    // Verify the notification belongs to the user
    if (notification.idReceiver.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "Unauthorized to mark this notification as read",
      });
      return;
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (err: unknown) {
    console.error("Mark as read error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    await Notification.updateMany(
      { idReceiver: userId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (err: unknown) {
    console.error("Mark all as read error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
