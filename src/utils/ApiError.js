// Custom API Error class — thrown in services/repositories, caught by the global error middleware.
class ApiError extends Error {

    constructor(message, statusCode = 400, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        // Capture correct stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    // Convenient factory methods
    static badRequest(message = "Bad request") {
        return new ApiError(message, 400);
    }

    static unauthorized(message = "Unauthorized") {
        return new ApiError(message, 401);
    }

    static forbidden(message = "Forbidden") {
        return new ApiError(message, 403);
    }

    static notFound(message = "Not found") {
        return new ApiError(message, 404);
    }

    static conflict(message = "Conflict") {
        return new ApiError(message, 409);
    }

    static internal(message = "Something went wrong please try again...") {
        return new ApiError(message, 500, false);
    }
}

export { ApiError };
