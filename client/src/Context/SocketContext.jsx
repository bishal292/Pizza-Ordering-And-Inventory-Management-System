import { useAppStore } from "@/Store/store";
import { HOST } from "@/utils/constant";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { toast } from "sonner";

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const socket = useRef(null);
  const { userInfo } = useAppStore();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userInfo?._id) return; // Avoid connecting if userInfo is null

    if (socket.current?.connected) {
      socket.current.disconnect();
    }

    socket.current = io(HOST, {
      withCredentials: true,
    });

    socket.current.on("connect", () => {
      console.log("Connected to socket server");
      setIsConnected(true);
    });

    socket.current.on("disconnect", () => {
      console.log("Disconnected from socket server");
      setIsConnected(false);
    });
    socket.current.on("updated-status", (data) => {
      toast.success(
        <div className="flex flex-col gap-2">
          <span className="font-bold">Order with id {data?.id} Status Updated to {data?.status}</span>
          {window.location.pathname === "/pizzeria/orders" ? (
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="text-sm font-bold text-blue-700"
            >
              Refresh
            </button>
          ) : (
            <a href={`/pizzeria/order/${data?._id}`} className="text-sm">
              View
            </a>
          )}
        </div>,
        {
          position: "top-right",
          duration: 5000,
          description: `your Order with id ${data?.id} status updated to ${data.status}`,
        }
      );
    });
    return () => {
      socket.current?.disconnect();
    };
  }, [userInfo]);

  return (
    <SocketContext.Provider
      value={{ socket: socket.current || null, isConnected }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
