import {Router} from 'express'
import { products,productDetails,Signup,BuyNow,orderSlip, showCart, addCart, Checkout, deleteCart, myOrders, Signin } from '../Controllers/userController.js';
const router = Router();

router.get("/product-info",products)

router.get("/product-details",productDetails)

router.post("/customerSignup",Signup)

router.post("/customerSignin", Signin);

router.post("/buynow",BuyNow);

router.get("/orderslip",orderSlip);

router.get("/showcart",showCart)

router.post("/checkout",Checkout);

router.put("/deletecart",deleteCart)

router.post("/addtocart",addCart)

router.get("/myorders",myOrders)

export default router;
