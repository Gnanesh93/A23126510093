import { useState, useEffect } from "react";
import { Container, Typography, Box, TextField, MenuItem, CircularProgress } from "@mui/material";
import NotificationCard from "../components/NotificationCard";
import { fetchNotifications } from "../api/notificationApi";
import { useNotificationContext } from "../context/NotificationContext";

const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

function getTop(notifications, n) {
  return notifications
    .map(notif => {
      const hours = (new Date() - new Date(notif.Timestamp)) / (1000 * 60 * 60);
      return { ...notif, score: (TYPE_WEIGHT[notif.Type] || 1) / (1 + hours) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

export default function PriorityPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topN, setTopN] = useState(10);
  const { markAsRead, isRead } = useNotificationContext();

  useEffect(() => {
    setLoading(true);
    fetchNotifications()
      .then(data => setNotifications(getTop(data, topN)))
      .finally(() => setLoading(false));
  }, [topN]);

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Priority Inbox</Typography>
        <TextField
          select size="small" value={topN}
          onChange={e => setTopN(Number(e.target.value))}
          sx={{ width: 120 }}
        >
          {[5, 10, 15, 20].map(n => (
            <MenuItem key={n} value={n}>Top {n}</MenuItem>
          ))}
        </TextField>
      </Box>

      {loading && <CircularProgress />}

      {!loading && notifications.map((n, i) => (
        <Box key={n.ID} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography color="text.secondary" sx={{ minWidth: 24 }}>{i + 1}.</Typography>
          <Box sx={{ flex: 1 }}>
            <NotificationCard
              notification={n}
              isRead={isRead(n.ID)}
              onClick={markAsRead}
            />
          </Box>
        </Box>
      ))}
    </Container>
  );
}