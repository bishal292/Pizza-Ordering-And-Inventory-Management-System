import { Router } from "express";
import {
  verifyAdmin,
  verifyToken,
  verifyTrustedRequestOrigin,
} from "../../Middlewares/AuthMiddleware.js";
import { AdminInfo, forgotpassword, logIn, logOut, resetpassword, signUp, changePassword, updateProfile} from "../../Controllers/Admin/AdminAuthController.js";

const adminAuthRouter = Router();

adminAuthRouter.post('/login',verifyTrustedRequestOrigin,logIn);
adminAuthRouter.post('/signup',verifyTrustedRequestOrigin, signUp);
adminAuthRouter.get('/logout',verifyTrustedRequestOrigin,verifyToken,verifyAdmin,logOut);
adminAuthRouter.patch('/profile',verifyTrustedRequestOrigin,verifyToken,verifyAdmin,updateProfile);
adminAuthRouter.patch('/changepassword',verifyTrustedRequestOrigin,verifyToken,verifyAdmin, changePassword);
adminAuthRouter.post('/forgotpassword',verifyTrustedRequestOrigin, forgotpassword);
adminAuthRouter.patch('/resetpassword',verifyTrustedRequestOrigin, resetpassword);
adminAuthRouter.get('/admin-info', verifyToken,verifyAdmin,AdminInfo);


export default adminAuthRouter;