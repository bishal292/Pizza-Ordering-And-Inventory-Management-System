import { useAppStore } from "@/Store/store";
import { HOST } from "@/utils/constant";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const socket = useRef(null);
  const { userInfo } = useAppStore();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (socket.current) {
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
    socket.current.on("new-order",(data)=>{
      toast.success(
        <div className="flex flex-col gap-2">
          <span className="font-bold">New Order with OrderId {data?.dailyOrderId} Placed</span>
          {window.location.pathname === "/admin/orders" ? (
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="text-sm font-bold text-blue-700"
            >
              Refresh
            </button>
          ) : (
            <a href={`/admin/order/${data?.id}`} className="text-sm">
              View
            </a>
          )}
        </div>,
        {
          position: "top-right",
          duration: 5000,
          description: `New Order placed with id ${data?.dailyOrderId}`,
        }
      );
    } )

    return () => {
      socket.current.disconnect();
    };
  }, [userInfo]);

  return (
    <SocketContext.Provider value={{ socket: socket.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};