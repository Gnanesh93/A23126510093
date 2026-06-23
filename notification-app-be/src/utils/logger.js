import axios from "axios";

const LOG_URL = "http://4.224.186.213/evaluation-service/logs";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";

const STACKS = ["backend", "frontend"];
const LEVELS = ["debug", "info", "warn", "error", "fatal"];
const PACKAGES = [
  "cache", "controller", "cron_job", "db", "domain",
  "handler", "repository", "route", "service",
  "api", "component", "hook", "page", "state", "style",
  "auth", "config", "middleware", "utils"
];

export const Log = async (stack, level, packageName, message) => {
  try {
    if (!STACKS.includes(stack)) throw new Error(`Invalid stack: ${stack}`);
    if (!LEVELS.includes(level)) throw new Error(`Invalid level: ${level}`);
    if (!PACKAGES.includes(packageName)) throw new Error(`Invalid package: ${packageName}`);

    const response = await axios.post(
      LOG_URL,
      { stack, level, package: packageName, message },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    return response.data;
  } catch (error) {
    return {
      success: false,
      error: error?.response?.data || error.message
    };
  }
};