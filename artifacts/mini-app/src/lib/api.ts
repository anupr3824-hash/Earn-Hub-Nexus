import axios from "axios";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export const axiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("tg_user_id");
  if (token) {
    config.headers["x-telegram-id"] = token;
  }
  return config;
});
