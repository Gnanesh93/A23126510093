import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import Navbar from "./components/Navbar";
import NotificationsPage from "./pages/NotificationsPage";
import PriorityPage from "./pages/PriorityPage";
import { NotificationProvider } from "./context/NotificationContext";

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, background: { default: "#f5f5f5" } }
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Navigate to="/notifications" />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/priority" element={<PriorityPage />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </ThemeProvider>
  );
}