import { Card, CardContent, Typography, Chip, Box } from "@mui/material";

const typeColors = { Placement: "success", Result: "warning", Event: "info" };

export default function NotificationCard({ notification, isRead, onClick }) {
  const { ID, Type, Message, Timestamp } = notification;

  return (
    <Card
      onClick={() => onClick(ID)}
      className="notification-card"
      sx={{
        mb: 1.5,
        cursor: "pointer",
        border: isRead ? "1px solid #ddd" : "1px solid #1976d2",
        backgroundColor: isRead ? "#fff" : "#f0f7ff"
      }}
    >
      <CardContent sx={{ display: "flex", justifyContent: "space-between" }}>
        <Box>
          <Typography fontWeight={isRead ? 400 : 600}>{Message}</Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(Timestamp).toLocaleString()}
          </Typography>
        </Box>
        <Chip label={Type} color={typeColors[Type]} size="small" />
      </CardContent>
    </Card>
  );
}