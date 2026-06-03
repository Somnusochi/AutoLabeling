import axios from "axios";

export const request = axios.create({
  baseURL: API_BASE,
  timeout: 300_000,
});

// Axios response interceptor to extract error details uniformly
request.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract server error messages or fallback to network error description
    const detail = error.response?.data?.detail;
    const message = typeof detail === "string" 
      ? detail 
      : (error.response?.data?.message || error.message || "Request failed");
    return Promise.reject(new Error(message));
  }
);
