# Notification System Design

# Stage 1

## understand the notification platform

As per the documentation given, these are the core things the notification system should support:
- show all notifications to a logged in student
- let students mark a notification as read
- mark all as read at once
- get count of unread notifications
- delete a notification
- get a single notification's details

---

## Base URL
http://localhost:5000/api     
- backend url here.

# All routes are protected. Every request needs a JWT token in the header:
Authorization: Bearer <token>

---

## Endpoints

### 1. GET /notifications

Gets all notifications for the logged in student. Supports filtering and pagination.

**Headers:**
**Query params:**
- `page` – which page (default 1)
- `limit` – how many per page (default 20)
- `notification_type` – filter by Event / Result / Placement
- `is_read` – true or false

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
        "type": "Placement",
        "message": "CSX Corporation hiring",
        "is_read": false,
        "created_at": "2026-04-22T17:51:30Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100
    }
  }
}
```

---

### 2. GET /notifications/:id

Gets one notification by its id.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
    "type": "Result",
    "message": "mid-sem results published",
    "is_read": false,
    "created_at": "2026-04-22T17:51:30Z"
  }
}
```

If not found:
```json
{
  "success": false,
  "error": "Notification not found"
}
```

---

### 3. PATCH /notifications/:id/read

Marks one notification as read.

**Request body:**
```json
{
  "is_read": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

### 4. PATCH /notifications/read-all

Marks all notifications as read for the current user.

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

### 5. GET /notifications/unread-count

Returns how many unread notifications the student has.

**Response:**
```json
{
  "success": true,
  "data": {
    "unread_count": 12
  }
}
```

---

### 6. DELETE /notifications/:id

Deletes a notification.

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

---

## Notification object structure

This is what a notification looks like:

```json
{
  "id": "uuid",
  "student_id": "uuid",
  "type": "Event | Result | Placement",
  "message": "string",
  "is_read": false,
  "created_at": "2026-04-22T17:51:30Z"
}
```

---

## Real-time notifications

I went with WebSockets (using Socket.IO) for real-time delivery because polling would hammer the server every few seconds which doesn't scale. SSE is one-way only. WebSockets let the server push directly to the student as soon as something happens.

**How it works:**
1. Student logs in, frontend opens a WebSocket connection and sends the JWT
2. Server verifies the token and puts that socket into a room named after the student id
3. When a new notification is triggered, server emits it directly to that student's room
4. Frontend picks it up and shows it without any reload

**Events:**

| Event | Who sends it | What's in it |
|---|---|---|
| `connect` | client | `{ token: "jwt here" }` |
| `new_notification` | server | `{ id, type, message, created_at }` |
| `notification_read` | client | `{ notification_id: "uuid" }` |

**Rough backend code:**
```js
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const student = verifyJWT(token);
  socket.studentId = student.id;
  next();
});

io.on("connection", (socket) => {
  socket.join(`student_${socket.studentId}`);
});

// called when a new notification needs to go out
function pushNotification(studentId, notification) {
  io.to(`student_${studentId}`).emit("new_notification", notification);
}
```

---

## Error responses

All errors come back like this:

```json
{
  "success": false,
  "error": "some message explaining what went wrong"
}
```

Status codes I'm using:
- 200 – all good
- 400 – bad request (missing fields etc)
- 401 – not logged in / bad token
- 404 – resource not found
- 500 – something broke on the server