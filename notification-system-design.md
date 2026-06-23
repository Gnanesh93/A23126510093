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

---

# Stage 2

## Which DB did I pick and why?

I went with MongoDB. The notification data maps naturally to documents — each notification is basically a JSON object with an id, type, message, read status and timestamp. MongoDB stores data exactly like that so it fits well here.

Also since I'm more comfortable with MongoDB and Mongoose, it'll be easier to implement correctly in the actual code.

---

## DB Schema (Mongoose)

```js
// students collection
{
  _id: ObjectId,
  name: String,
  email: String,        // unique
  password: String,     // hashed
  createdAt: Date
}

// notifications collection
{
  _id: ObjectId,
  studentId: ObjectId,  // ref to students
  type: String,         // enum: Event, Result, Placement
  message: String,
  isRead: Boolean,      // default false
  createdAt: Date       // default now
}
```

---

## Problems as data grows

With 50,000 students and 5,000,000 notifications:

1. **Queries slow down** — finding all unread notifications for a student scans the whole collection if there's no index on studentId and isRead. With 5M documents that's very slow.

2. **Count queries are expensive** — countDocuments() with a filter on every request adds up fast at scale.

3. **Fetching everything at once** — if we don't paginate and just return all notifications for a student, the response payload gets huge and memory usage spikes.

4. **Storage** — old notifications pile up and slow down queries even though nobody reads them.

---

## How I'd fix these

**Add indexes:**
```js
notificationSchema.index({ studentId: 1 });
notificationSchema.index({ studentId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });
```

**Cache unread count in Redis** — instead of running countDocuments every time, store the count and update it when a notification is read or a new one arrives.

**Paginate everything** — never return the full list, always use limit and skip or cursor based pagination.

**TTL index for old data** — MongoDB supports TTL indexes that auto-delete documents after a certain time, useful for archiving old notifications automatically.

```js
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days
```

---

## Queries

**GET /notifications**
```js
await Notification.find({ studentId })
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit);
```

With type filter:
```js
await Notification.find({ studentId, type })
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit);
```

**GET /notifications/:id**
```js
await Notification.findOne({ _id: id, studentId });
```

**GET /notifications/unread-count**
```js
await Notification.countDocuments({ studentId, isRead: false });
```

**PATCH /notifications/:id/read**
```js
await Notification.findOneAndUpdate(
  { _id: id, studentId },
  { isRead: true }
);
```

**PATCH /notifications/read-all**
```js
await Notification.updateMany(
  { studentId, isRead: false },
  { isRead: true }
);
```

**DELETE /notifications/:id**
```js
await Notification.findOneAndDelete({ _id: id, studentId });
```

---

# Stage 3

## Is the query accurate?

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

The logic is correct — fetching unread notifications for a student ordered oldest first makes sense. But since we're using MongoDB, this is not how we'd write it. The equivalent in Mongoose would be:

```js
await Notification.find({ studentId: "1042", isRead: false })
  .sort({ createdAt: 1 });
```

---

## Why is it slow?

With 5,000,000 notifications and no indexes, MongoDB has to scan every single document in the collection to find the ones matching that studentId and isRead. That's a full collection scan on 5M documents every time someone opens their notifications. That's why it's slow.

With the compound index we added in Stage 2 on `{ studentId, isRead }`, MongoDB can jump directly to that student's unread documents instead of scanning everything. Query time drops from scanning 5M docs to scanning just that student's records.

---

## Should we add indexes on every column?

No, that's not good advice. Indexes speed up reads but every index has to be updated on every write (insert, update, delete). If you index every field:

- inserts and updates become slower because all indexes need updating
- more memory and disk space is used for index storage
- MongoDB's query planner can get confused picking between too many indexes

Only index fields you actually query or filter on. In our case `studentId`, `isRead`, `createdAt` make sense because we filter and sort on them constantly. Indexing `message` for example would be completely pointless.

---

## Query to find all students who got a Placement notification in the last 7 days

```js
await Notification.find({
  type: "Placement",
  createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
}).distinct("studentId");
```

If you want student details along with it:

```js
await Notification.aggregate([
  {
    $match: {
      type: "Placement",
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }
  },
  {
    $group: {
      _id: "$studentId"
    }
  },
  {
    $lookup: {
      from: "students",
      localField: "_id",
      foreignField: "_id",
      as: "studentInfo"
    }
  },
  {
    $unwind: "$studentInfo"
  },
  {
    $project: {
      _id: 0,
      studentId: "$_id",
      name: "$studentInfo.name",
      email: "$studentInfo.email"
    }
  }
]);
```

---

# Stage 4

## Problem

Right now every time a student opens the app or changes page, we're hitting MongoDB to fetch notifications. With 50,000 students doing this constantly the DB just can't keep up. It gets overwhelmed and everything slows down.

---

## What I'd suggest

### 1. Cache with Redis

Instead of going to MongoDB every page load, we store the notifications in Redis the first time we fetch them. Next time the same student loads the page we just return from Redis, no DB call needed.

I'd set a TTL of around 60 seconds on the cache. When the student marks something as read or a new notification comes in we clear that student's cache so they get fresh data on the next load.

**Tradeoff:** There's a window of up to 60 seconds where the student might see slightly old data. Also we're now running Redis alongside MongoDB which is one more thing to manage. But the DB load goes down a lot so it's worth it.

---

### 2. Stop fetching on every page load — use WebSockets

We already set up WebSockets in Stage 1. So instead of re-fetching notifications every time the page changes, we fetch once when the student logs in and then just listen for new notification events from the server. The frontend updates in real time without hitting the DB again.

**Tradeoff:** If the socket disconnects and reconnects we need to re-fetch to sync up. But this is a rare case and easy to handle. For the normal flow this saves a lot of unnecessary DB calls.

---

### 3. Paginate the list

Don't load all notifications at once. Load the first 20, then fetch more as the student scrolls. Each request is much cheaper and the initial page load is faster.

**Tradeoff:** Simplest fix of all three. Doesn't reduce the number of requests but makes each request way lighter. Should honestly be there from the start.

---

### 4. Cache the unread count separately

The unread badge shows on every page so it gets fetched constantly. Instead of running a countDocuments query each time, just store the number in Redis and update it when something changes.

```js
// new notification comes in
await redis.incr(`unread:student_${studentId}`);

// student marks one as read
await redis.decr(`unread:student_${studentId}`);

// fetch count
const count = await redis.get(`unread:student_${studentId}`);
```

**Tradeoff:** Count could be off by 1 in rare edge cases but that's fine for a badge. Saves a DB call on every single page load across all students.

---

## What I'd actually do

Use all four together. Cache the list in Redis, push new ones via WebSocket, paginate the list, and cache the unread count. Each one helps on its own but combined they actually solve the problem properly.
