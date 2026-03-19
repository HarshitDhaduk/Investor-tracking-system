import express from "express";
import cors from "cors";
import path from "path";
import fileUpload from "express-fileupload";
import { CONFIG } from "./src/config/flavour.js";
import { POOL } from "./src/config/database.js";

// Create Server
const server = express();

// Check DB Connection
POOL.connect()
  .then(client => {
    console.log("DB Connected Successfully");
    client.release();
  })
  .catch(err => {
    console.log("DB Error: " + err.message);
  });

// Parse JSON request bodies
server.use(express.json());

// Parse URL-encoded request bodies
server.use(express.urlencoded({ extended: true }));

// Configure express-fileupload middleware for handling file uploads
server.use(fileUpload({ createParentPath: true }));

// Configure CORS middleware
server.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "UPDATE", "PUT", "PATCH"],
    credentials: true
  })
);

// Serve static files from the "public" directory
server.use(express.static(path.join(path.resolve(), "public")));

// Routes
import router from "./src/routes/index.js";
server.use("/api", router);

server.use((req, res, next) => {
  const fullPath = req.originalUrl;
  if (fullPath.startsWith(`/${CONFIG.STATIC_ROUTE}`)) {
    res.sendFile("index.html", {
      root: path.join(process.cwd(), `public/${CONFIG.STATIC_ROUTE}/`),
    });
  } else {
    return res.status(404).json({ s: 0, m: "Page not found" });
  }
});

// Error Handler Middleware
import { errorHandler } from "./src/middlewares/error.middleware.js";
server.use(errorHandler);

// SERVER START
server.listen(CONFIG.PORT, () => {
  console.log("Server is start on port", CONFIG.PORT);
});
