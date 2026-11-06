import { Router } from "express";
import userAuthRouter from "./userAuthRoutesHandler.js";
import {
  getPizzas,
  addToCart,
  getCart,
  removeFromCart,
  clearCart,
  getOptions,
  placeOrder,
  getOrders,
  getOrderDetails,
  cancelOrder,
  completePayment,
} from "../../Controllers/User/UserMiscControllers.js";
import {
  verifyToken,
  verifyTrustedRequestOrigin,
} from "../../Middlewares/AuthMiddleware.js";
import { verifyPayment } from "../../Services/RazorPay.js";


const UserRouter = Router();

UserRouter.use('/auth', userAuthRouter);

UserRouter.get('/pizzas', getPizzas);
UserRouter.post('/cart',verifyTrustedRequestOrigin, verifyToken, addToCart);
UserRouter.get('/cart',verifyToken, getCart);
UserRouter.delete('/cart',verifyTrustedRequestOrigin, verifyToken, removeFromCart);
UserRouter.get('/options', getOptions);// Get all the options for customizing the pizza
UserRouter.delete('/cart/clear',verifyTrustedRequestOrigin, verifyToken, clearCart);
UserRouter.post('/place-order',verifyTrustedRequestOrigin, verifyToken, placeOrder);
UserRouter.get('/orders',verifyToken, getOrders);
UserRouter.get('/order/details',verifyToken, getOrderDetails);
UserRouter.post("/order/verify-payment",verifyTrustedRequestOrigin, verifyToken, verifyPayment);
UserRouter.post(
  "/order/complete-payment",
  verifyTrustedRequestOrigin,
  verifyToken,
  completePayment
);
UserRouter.post(
  "/order/cancel",
  verifyTrustedRequestOrigin,
  verifyToken,
  cancelOrder
);
export default UserRouter;