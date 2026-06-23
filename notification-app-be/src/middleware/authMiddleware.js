import jwt from "jsonwebtoken";
import {Log} from "../utils/logger.js";

// Middleware to authenticate users
const authMiddleware = async(req,res,next)=>{
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      await Log("backend", "warn", "middleware", "Request with no token received");
      return res.status(401).json({success: false,error: "Unauthorized: No token provided"});
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.student = decoded;

    await Log("backend", "info", "middleware", `Auth successful for student ${decoded.id}`);
    next();
  } 
  catch (error) {
    await Log("backend", "error", "middleware", `Auth failed: ${error.message}`);
    return res.status(401).json({success: false,error: "Unauthorized: Invalid token"});
  }
};

export default authMiddleware;