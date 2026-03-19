import { ApiError } from "../utils/ApiError.js";

// Global error handling middleware. Catches ApiError and unknown errors.
const errorHandler = (err, req, res, next) => {
    // Default values
    let statusCode = err.statusCode || 500;
    let message = err.message || "Something went wrong please try again...";
    let errorDetails = null;

    if (err instanceof ApiError) {
        // Operational error — safe to show message to client
        statusCode = err.statusCode;
        message = err.message;
    } else {
        // Programming or unknown error — log full details, show generic message
        console.error("Unexpected Error:", err);
        statusCode = 500;
        message = "Something went wrong please try again...";
        errorDetails = process.env.NODE_ENV === "LOCAL" ? err.stack : null;
    }

    return res.status(statusCode).json({
        s: 0,
        m: message,
        r: null,
        c: null,
        err: errorDetails,
    });
};

export { errorHandler };
