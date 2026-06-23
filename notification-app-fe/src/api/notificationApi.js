export function fetchNotifications() {
}
import axios from "axios";

const API_URL = "http://4.224.186.213/evaluation-service/notifications";
const TOKEN = import.meta.env.VITE_ACCESS_TOKEN || "";

const headers = { Authorization: `Bearer ${TOKEN}` };

export async function fetchNotifications(params = {}) {
  const res = await axios.get(API_URL, { headers, params });
  return res.data.notifications || [];
}