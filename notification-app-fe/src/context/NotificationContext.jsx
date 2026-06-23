import { createContext, useContext, useState } from "react";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [readIds, setReadIds] = useState([]);

  const markAsRead = (id) => setReadIds(prev => [...new Set([...prev, id])]);
  const markAllAsRead = (ids) => setReadIds(prev => [...new Set([...prev, ...ids])]);
  const isRead = (id) => readIds.includes(id);

  return (
    <NotificationContext.Provider value={{ markAsRead, markAllAsRead, isRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotificationContext = () => useContext(NotificationContext);