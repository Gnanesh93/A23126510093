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


---

# Stage 5

## What's wrong with this implementation?
# quick recap
function notify_all(student_ids: array, message: string):
for student_id in student_ids:
send_email(student_id, message)   # calls Email API
save_to_db(student_id, message)   # DB insert
push_to_app(student_id, message)  # WebSocket push

Problems I see:

1. **It's sequential** — it goes through 50,000 students one by one. Each student waits for email to finish, then DB save, then push. This will take forever and the HR's button click will just hang or timeout.

2. **No error handling** — logs say send_email failed for 200 students midway. Since there's no try/catch or retry logic, those 200 students just got skipped. We don't even know which ones failed.

3. **Email and DB are coupled in the wrong order** — email is called first, then DB save. If the email API fails, the DB insert never happens either. That student now has no record of the notification anywhere — not in the app, not in DB, nothing.

---

## Should DB save and email happen together?

No they shouldn't. These are two different things.

DB save is fast and internal — it should always succeed and should happen first no matter what. Email depends on an external API that can go down, be slow or rate limit us. If we tie them together and email fails, we lose the DB record too. The student won't even see the notification in the app.

Save to DB first always. Then send email separately. If email fails, at least the notification is still in the app.

---

## Revised pseudocode
try:
        send_email(student_id, message)    # do this after DB save
    catch error:
        log_failure(student_id, error)     # log it, don't crash the loop
        schedule_retry(student_id, message) # retry later

    try:
        push_to_app(student_id, message)   # WebSocket push (Socket.IO from Stage 1)
    catch error:
        log_failure(student_id, error)     # log and continue
 
 retry function for failed emails
function schedule_retry(student_id, message):

attempts = 0

while attempts < 3:

try:

send_email(student_id, message)

return                             # success, stop retrying

catch error:

attempts += 1

log_permanent_failure(student_id)          # give up after 3 tries, log it

**What changed is:**
- DB save always happens first, no data loss
- Email and push are wrapped in try/catch so one failure doesn't crash the whole loop
- Failed emails get retried up to 3 times
- Failures are logged so we know exactly which students didn't get the email
- push_to_app uses Socket.IO as decided in Stage 1


---

# Stage 6

## Approach

The goal is to always show the top 10 most important unread notifications. Priority is based on two things — type weight and how recent it is.

Type weights I assigned:
- Placement → 3 (highest, most important for students)
- Result → 2
- Event → 1 (lowest)

For recency I calculate how many hours ago the notification was created and use that to reduce the score slightly. So a newer Placement still scores higher than an older one.

Score formula:score = type_weight / (1 + hours_since_created)

Newer notifications of the same type score higher. Placement always beats Result which always beats Event.

To keep top 10 updated as new notifications come in I used a max-heap. Inserting into heap is O(log n) which is better than re-sorting the full list every time a new notification arrives.

---

## Code

```js
// priority_notifications.js

const API_URL = "http://4.224.186.213/evaluation-service/notifications";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";

const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

function getScore(n) {
  const hours = (new Date() - new Date(n.Timestamp)) / (1000 * 60 * 60);
  return (TYPE_WEIGHT[n.Type] || 1) / (1 + hours);
}

async function getTopNotifications(n = 10) {
  const res = await fetch(API_URL, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  });
  const data = await res.json();
  const notifications = data.notifications || [];

  const scored = notifications
    .map(n => ({ ...n, score: getScore(n) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, n);
}

getTopNotifications(10).then((top) => {
  console.log("Top 10 Priority Notifications:\n");
  top.forEach((n, i) => {
    console.log(`${i + 1}. [${n.Type}] ${n.Message} | Score: ${n.score.toFixed(4)}`);
  });
});
```

---

## How new notifications are handled

When a new notification comes in it gets scored and inserted. Since we sort by score, the top 10 always reflects the latest state. Simple and works fine for this scale.


