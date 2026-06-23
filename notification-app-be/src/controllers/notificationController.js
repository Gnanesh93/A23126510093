import axios from "axios";
import {Log} from "../utils/logger.js";

const NOTIFICATION_API = process.env.NOTIFICATION_API;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1
};

function getScore(notification) {
  const createdAt = new Date(notification.Timestamp);
  const now = new Date();
  const hoursSince = (now - createdAt) / (1000 * 60 * 60);
  const weight = TYPE_WEIGHT[notification.Type] || 1;
  return weight / (1 + hoursSince);
}

// fetch from evaluation API
async function fetchFromAPI(queryParams = {}) {
  const params = new URLSearchParams(queryParams).toString();
  const url = params ? `${NOTIFICATION_API}?${params}` : NOTIFICATION_API;

  const response = await axios.get(url, {headers: {Authorization: `Bearer ${ACCESS_TOKEN}`}});
  return response.data.notifications || [];
}

// GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    await Log("backend", "info", "controller", "Fetching all notifications");

    const { page = 1, limit = 20, notification_type } = req.query;
    const params = {};
    if (notification_type) params.notification_type = notification_type;
    if (page) params.page = page;
    if (limit) params.limit = limit;

    const notifications = await fetchFromAPI(params);

    await Log("backend", "info", "controller", `Fetched ${notifications.length} notifications`);

    return res.status(200).json({success: true,
      data: {
        notifications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: notifications.length
        }
      }
    });
  } 
  catch (error) {
    await Log("backend", "error", "controller", `Failed to fetch notifications: ${error.message}`);
    return res.status(500).json({success: false,error: "Failed to fetch notifications"});
  }
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    await Log("backend", "info", "controller", "Fetching unread count");

    const notifications = await fetchFromAPI();
    const unreadCount = notifications.filter(n => !n.isRead).length;

    return res.status(200).json({success: true,data: { unread_count: unreadCount }});
  } 
  catch (error) {
    await Log("backend", "error", "controller", `Failed to fetch unread count: ${error.message}`);
    return res.status(500).json({success: false, error: "Failed to fetch unread count"});
  }
};

// GET /api/notifications/priority
export const getPriorityNotifications = async (req, res) => {
  try {
    await Log("backend", "info", "controller", "Fetching priority notifications");

    const { n = 10, notification_type } = req.query;
    let notifications = await fetchFromAPI();

    if (notification_type) {
      notifications = notifications.filter(notif => notif.Type === notification_type);
    }

    const scored = notifications.map(notif => ({
      ...notif,
      score: getScore(notif)
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, Number(n));

    await Log("backend", "info", "controller", `Returning top ${n} priority notifications`);

    return res.status(200).json({success: true,data: { notifications: top }});
  } 
  catch (error) {
    await Log("backend", "error", "controller", `Failed to fetch priority notifications: ${error.message}`);
    return res.status(500).json({success: false,error: "Failed to fetch priority notifications"});
  }
};

// GET /api/notifications/:id
export const getNotificationById = async (req, res) => {
  try {
    await Log("backend", "info", "controller", `Fetching notification ${req.params.id}`);

    const notifications = await fetchFromAPI();
    const notification = notifications.find(n => n.ID === req.params.id);

    if (!notification) {
      await Log("backend", "warn", "controller", `Notification ${req.params.id} not found`);
      return res.status(404).json({success: false,error: "Notification not found"});
    }

    return res.status(200).json({success: true,data: notification});
  } 
  catch (error) {
    await Log("backend", "error", "controller", `Failed to fetch notification: ${error.message}`);
    return res.status(500).json({success: false,error: "Failed to fetch notification"});
  }
};