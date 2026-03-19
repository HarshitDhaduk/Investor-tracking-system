// Standardized API Response Helper
class ApiResponse {
  // Send a success response
  static success(res, data = null, message = "Success", statusCode = 200, count = null) {
    return res.status(statusCode).json({
      s: 1,
      m: message,
      r: data,
      c: count,
      err: null,
    });
  }

  // Send an error response
  static error(res, message = "Something went wrong please try again...", statusCode = 400, err = null) {
    return res.status(statusCode).json({
      s: 0,
      m: message,
      r: null,
      c: null,
      err: err,
    });
  }
}

export { ApiResponse };
