import axios from "axios";

export const request = axios.create({
  baseURL: API_BASE,
  timeout: DEFAULT_TIMEOUT,
});

// Axios response interceptor to extract error details uniformly
request.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract server error messages or fallback to network error description
    const detail = error.response?.data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : error.response?.data?.message || error.message || "Request failed";
    return Promise.reject(new Error(message));
  },
);

export const DETECT_TIMEOUT = 600_000;       // 10 min — ML inference can be slow
export const UPLOAD_TIMEOUT = 300_000;       // 5 min — chunked uploads
export const DEFAULT_TIMEOUT = 60_000;        // 1 min — list/rename/cancel etc.
