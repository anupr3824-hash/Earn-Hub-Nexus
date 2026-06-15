import axios from "axios";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export const axiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("admin_token");
      window.location.href = import.meta.env.BASE_URL + "login";
    }
    return Promise.reject(err);
  }
);
