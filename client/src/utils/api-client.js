import axios from "axios";
import { HOST } from "./constant";

export const apiClient = axios.create({
    baseURL: HOST,
    withCredentials: true,
    timeout: 45000,
})