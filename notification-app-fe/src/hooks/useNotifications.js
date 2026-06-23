import { useState, useEffect } from "react";
import { fetchNotifications } from "../api/notificationApi";

export function useNotifications(params) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchNotifications(params)
      .then(data => {
        setNotifications(data);
        setError(null);
      })
      .catch(() => setError("Failed to load notifications"))
      .finally(() => setLoading(false));
  }, [params.notification_type, params.page]);

  return { notifications, loading, error };
}