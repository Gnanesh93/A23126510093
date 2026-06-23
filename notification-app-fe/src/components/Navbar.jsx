import { AppBar, Toolbar, Typography, Button } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppBar position="sticky">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
          CampusNotify
        </Typography>
        <Button color="inherit"
          onClick={() => navigate("/notifications")}
          sx={{ fontWeight: location.pathname === "/notifications" ? 700 : 400 }}>
          All
        </Button>
        <Button color="inherit"
          onClick={() => navigate("/priority")}
          sx={{ fontWeight: location.pathname === "/priority" ? 700 : 400 }}>
          Priority
        </Button>
      </Toolbar>
    </AppBar>
  );
}