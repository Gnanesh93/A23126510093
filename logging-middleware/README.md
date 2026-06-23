## Logging Middleware


Reusable logging package for frontend and backend applications.

## Function Declaration

```js
Log(stack, level, packageName, message)
```

## Parameters

| Parameter | Type | Description |
|------------|------|-------------|
| stack | string | frontend or backend |
| level | string | debug, info, warn, error, fatal |
| packageName | string | valid package name as per specification |
| message | string | descriptive log message |

---

## Allowed Stack Values

```text
backend
frontend
```

## Allowed Level Values

```text
debug
info
warn
error
fatal
```

## Example

```js
import { Log } from "./index.js";

await Log(
  "backend",
  "info",
  "route",
  "Fetching notifications"
);
```

## Backend Example

```js
await Log(
  "backend",
  "error",
  "handler",
  "Received string, expected boolean"
);
```

## Frontend Example

```js
await Log(
  "frontend",
  "info",
  "page",
  "Notifications page loaded"
);
```

## Success Response

```json
{
  "logID": "a4aad02e-19d0-4153-86d9-58bf55d7c402",
  "message": "log created successfully"
}
```

## Notes

- Uses the provided Logging API.
- Supports both frontend and backend applications.
- Should be used instead of console logging.
- All significant operations, warnings, errors and debugging information should be logged.
