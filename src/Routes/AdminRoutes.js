import {Router} from 'express';
import { adminSignin, Deliver,details, editProduct, getOrder, orderDetail,remove, productDetails, productListing, Ship, updateQuantity, priceStock } from '../Controllers/adminControllers.js';
import { cpUpload } from '../Utils/Utils.js';
const router = Router();

router.post("/adminSignin",adminSignin);

router.post("/listingproduct",cpUpload,productListing);

router.get("/product-details",productDetails)

router.put("/editproduct",editProduct);

router.get("/getorder", getOrder);

router.get("/orderdetails",orderDetail);

router.put("/ship",Ship)

router.put("/deliver",Deliver)

router.delete("/delete",remove)

router.get("/details",details)

router.put("/updatequantity",updateQuantity)

router.put('/price&stock',priceStock )

export default router;