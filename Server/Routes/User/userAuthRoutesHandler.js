import { Router } from "express";
import {
  verifyToken,
  verifyTrustedRequestOrigin,
} from "../../Middlewares/AuthMiddleware.js"
import { UserInfo, forgotpassword, logIn, logOut, resetpassword, signUp, changePassword, updateProfile} from "../../Controllers/User/userAuthController.js";


const userAuthRouter = Router();


userAuthRouter.post('/login',verifyTrustedRequestOrigin,logIn);
userAuthRouter.post('/signup',verifyTrustedRequestOrigin, signUp);
userAuthRouter.post('/logout',verifyTrustedRequestOrigin,verifyToken,logOut);
userAuthRouter.patch('/profile',verifyTrustedRequestOrigin,verifyToken,updateProfile);
userAuthRouter.patch('/changepassword',verifyTrustedRequestOrigin,verifyToken, changePassword);
userAuthRouter.post('/forgotpassword',verifyTrustedRequestOrigin, forgotpassword);
userAuthRouter.patch('/resetpassword/',verifyTrustedRequestOrigin, resetpassword);
userAuthRouter.get('/user-info', verifyToken,UserInfo);


export default userAuthRouter;