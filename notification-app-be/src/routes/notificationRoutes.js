import express from "express";
import {getNotifications,getNotificationById,getUnreadCount,getPriorityNotifications} from "../controllers/notificationController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {Log} from "../utils/logger.js";

const router = express.Router();

router.use(async (req, res, next) => {
  await Log("backend", "info", "route", `${req.method} ${req.originalUrl}`);
  next();
});
//1.All notifications
router.get("/", authMiddleware, getNotifications);
//2.only unread notification count
router.get("/unread-count", authMiddleware, getUnreadCount);
//3.important notifications based on priority
router.get("/priority", authMiddleware, getPriorityNotifications);
//get each notification
router.get("/:id", authMiddleware, getNotificationById);

export default router;