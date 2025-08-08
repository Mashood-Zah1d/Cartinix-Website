const express = require ("express");
const cors = require ("cors");
const {Pool} = require ("pg");
const bcrypt = require ("bcrypt");
require("dotenv").config();
const app = express();
app.use(express.json());
app.use(cors());
app.use("/photos", express.static("photos"));

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.mail,
    pass: process.env.password,
  },
});


const path = require ("path");
const multer = require ("multer");
const { emit } = require("process");
const storage = multer.diskStorage({
    destination : function (req,file,cb) {
        cb(null,"photos/")
    },
   filename: function (req, file, cb) {
  const ext = path.extname(file.originalname);
  const timestamp = Date.now();
  cb(null, `${timestamp}${ext}`);
}
})

const upload = multer({storage:storage});

const cpUpload = upload.fields([
  { name: 'main_image', maxCount: 1 },
  { name: 'colorImages', maxCount: 10 }
]);
const pool = new Pool({
    connectionString:process.env.url,
    ssl: {
    rejectUnauthorized: false, 
  },
})

app.get("/product-info",async (req,res)=>{
    try{
        const result = await pool.query(`select * from Product`);
        res.json(result.rows);
    }
    catch(err){
        res.json({Error: "Error Fetching Data"});
    }
})

app.get("/product-details",async (req,res)=>{
    const productid= req.query.productid;
    try{
        const result = await pool.query(`select * from Product where sku= $1`,[productid]);
        
        const image = await pool.query(`select image_path from ProductImages where sku = $1`,[productid]);
        const color = await pool.query(`select color_name from  ProductColors where sku = $1`,[productid]);
        
         res.json({details: result.rows[0],
                   images : image.rows,
                   color:color.rows
    })
    }
    catch(err){
        res.json({Error: "Error Fetching Data"});
    }
})

app.get("/details",async (req,res)=>{
    try{
        const result = await pool.query(`select * from Product`);  
         res.json(result.rows)
    }
    catch(err){
        res.json({Error: "Error Fetching Data"});
    }
})

app.post("/adminSignup",async(req,res)=>{
    const {name,email,password} = req.body;
    try{
        const hashedpassword = await bcrypt.hash(password,10);
        await pool.query(`insert into admin (name,email,password) values ($1,$2,$3)`,[name,email,hashedpassword]);
        res.status(200).json({message  :"Your Sign-Up Application Has Been Accepted"});
    }
    catch(err){
        res.status(500).json({Error: "Your Sign-Up Application Has Been Rejected For Reason"+err});
    }
})

app.post("/customerSignup",async(req,res)=>{
    const {name,email,password} = req.body;
    try{
        const hashedpassword = await bcrypt.hash(password,10);
        await pool.query(`insert into Customers (name,email,password) values ($1,$2,$3)`,[name,email,hashedpassword]);
        res.status(200).json({message :"Your Sign-Up Application Has Been Accepted"});
    }
    catch(err){
        res.status(500).json({ Error: "Your Sign-Up Application Has Been Rejected For Reason"+err });
    }
})

app.post("/adminSignin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(`SELECT * FROM admin WHERE email = $1`, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Email not found" });
    }

    const isMatch = await bcrypt.compare(password, result.rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    res.status(200).json({ message: "Your Sign-In Application Has Been Accepted" });
  } catch (err) {
    res.status(500).json({ error: "Your Sign-in Application Has Been Rejected. Reason: " + err.message });
  }
});

app.post("/listingproduct", cpUpload, async (req, res) => {
  try {
    const {
      sku,
      title,
      description,
      brand,
      category,
      material,
      stock,
      price,
    } = req.body;

    const mainImage = req.files["main_image"]?.[0]?.filename;

    await pool.query(
      `INSERT INTO Product (sku, title, description, brand, category, material_type, stock, price, image_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [sku, title, description, brand, category, material, stock, price, mainImage]
    );

    let colorNames = req.body.color_names;

    if (!colorNames) {
      return res.status(200).json({ message: "Product listed without color variants." });
    }

    if (!Array.isArray(colorNames)) {
      colorNames = [colorNames];
    }

    // ✅ Fixed line here
    const colorImages = req.files["colorImages"] || [];

    for (let i = 0; i < colorNames.length; i++) {
      const color = colorNames[i];
      const image = colorImages[i]?.filename || null;

      await pool.query(
        `INSERT INTO ProductColors (sku, color_name) VALUES ($1, $2)`,
        [sku, color]
      );

      if (image) {
        await pool.query(
          `INSERT INTO ProductImages (sku, color_name, image_path) VALUES ($1, $2, $3)`,
          [sku, color, image]
        );
      }
    }

    res.status(200).json({ message: "Product listed successfully." });

  } catch (err) {
    console.error("Product listing error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});



   app.put("/editproduct", async (req, res) => {
  const { sku, title, description, brand, category, material } = req.body;

  try {
    const result = await pool.query(
      `UPDATE product SET title = $1, description = $2, brand = $3, category = $4, material_type = $5 WHERE sku = $6`,
      [title, description, brand, category, material, sku]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found." });
    }

    res.json({ message: "Data Updated" });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ error: "Problem updating: " + err.message });
  }
});

app.get("/getorder", async (req, res) => {
  try {
    const result = await pool.query(`
     SELECT p.sku, p.image_path, p.title, p.brand, od.order_id, od.price, od.quantity, o.status FROM product AS p JOIN order_detail AS od ON od.product_sku = p.sku JOIN orders AS o ON o.order_id = od.order_id;
    `);

    if (result.rows.length === 0) {
      return res.json({Error : "Wrong Order Id"}); 
    }

    res.json(result.rows); 
  } catch (err) {
    res.json({ Error: "Error Fetching Data: " + err });
  }
});

app.get("/orderdetails", async (req, res) => {
    const sku = req.query.sku;
    const orderid = req.query.orderid;
  try {
    const result = await pool.query(`
     SELECT c.customer_name,c.customer_address,c.customer_phone,c.customer_email,p.sku,p.image_path,p.title,o.order_id,o.order_date,od.price,od.quantity FROM product AS p JOIN order_detail AS od ON od.product_sku = p.sku JOIN orders AS o ON o.order_id = od.order_id JOIN customer AS c ON c.customer_id = o.customer_id WHERE od.product_sku = $1 AND o.order_id = $2;
    `,[sku,orderid]);

    if (result.rows.length === 0) {
      return res.json({Error : "Wrong Order Id"}); 
    }

    res.json(result.rows[0]); 
  } catch (err) {
    res.json({ Error: "Error Fetching Data: " + err });
  }
});

app.put("/ship",async (req,res)=>{
    const ship = 'shipped';
    const orderid = req.body.orderid;
    const order = parseInt(orderid);
    try{
       await pool.query(`Update orders set status = $1 where order_id = $2`,[ship,orderid]);
        res.json({message : "Order Has Been Shipped"});
    }
    catch(err){
        res.json({Error : "Error :"+err});
    }
})

app.put("/deliver",async (req,res)=>{
    const deliver = 'delivered';
    const orderid = req.body.orderid;
    const order = parseInt(orderid);
    try{
       await pool.query(`Update orders set status = $1 where order_id = $2`,[deliver,orderid]);
        res.json({message : "Order Has Been delivered"});
    }
    catch(err){
        res.json({Error : "Error :"+err});
    }
})

app.post("/buynow", async (req, res) => {
  const { name, email, phone, address, quantity, color, price, sku } = req.body;
  const payment = "Cash On Delivery"
  try {
    const customerResult = await pool.query(
      `INSERT INTO customer (customer_name, customer_phone, customer_email, customer_address)
       VALUES ($1, $2, $3, $4) RETURNING customer_id`,
      [name, phone, email, address]
    );

    const customer_id = customerResult.rows[0].customer_id;
    const order_date = new Date(); 
    const total_price = price * quantity;
    
       const order =  await pool.query(`INSERT INTO orders (customer_id,order_date,payment_method)
       VALUES ($1, $2, $3) RETURNING order_id`,[customer_id,order_date,payment]);

        const order_id = order.rows[0].order_id;

      await pool.query(
      `INSERT INTO order_detail (order_id,customer_id, product_sku, quantity, price ,color)
       VALUES ($1, $2, $3, $4, $5,$6) RETURNING order_id`,
      [order_id,customer_id, sku, quantity, total_price,color]
    );
  const mailOptions = {
  from: process.env.mail, 
  to: email, 
  subject: 'Order Confirmation - Watch Store',
  html: `
    
    <div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
  <h2 style="color: #2c3e50; text-align: center; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">Thank You for Your Order!</h2>
  
  <p style="font-size: 18px; color: #34495e; margin-top: 20px;">
    <strong>Order ID:</strong> <span style="color: #e67e22;">${order_id}</span>
  </p>
  
  <p style="font-size: 16px; color: #2c3e50; margin-top: 20px;">
    We appreciate your Order and hope you enjoy your purchase. If you have any questions or need assistance, feel free to contact us:
  </p>
  
  <ul style="list-style: none; padding: 0; font-size: 16px; color: #2c3e50; margin-top: 10px;">
    <li><strong>WhatsApp:</strong> <a href="https://wa.me/923314745405" style="color: #27ae60; text-decoration: none;">0331-4745405</a></li>
    <li><strong>Email:</strong> <a href="mailto:cartinix.officials@gmail.com" style="color: #2980b9; text-decoration: none;">cartinix.officials@gmail.com</a></li>
  </ul>

  <p style="margin-top: 30px; font-size: 16px; color: #7f8c8d;">
    Regards, <br>
    <strong style="font-size: 18px; color: #e67e22;">Cartinix</strong>
  </p>
</div>
  `
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Email sending failed:', error);
  } else {
    console.log('Email sent:', info.response);
  }})
    res.json({order_id});
  } catch (err) {
    console.error("Order Error:", err.message);
    res.status(500).json({ error: "There was an issue placing the order." });
  }
});

app.get("/orderslip", async (req, res) => {
  const {orderid}  = req.query;
  const order= parseInt(orderid);
  try {
    const result = await pool.query(
      `SELECT od.order_id, od.product_sku, od.customer_id, od.quantity, od.price, od.color,
       o.payment_method, o.status, o.order_date,
       p.title, p.sku, p.image_path,
       c.customer_name, c.customer_email, c.customer_phone, c.customer_address
FROM order_detail AS od
JOIN orders AS o ON od.order_id = o.order_id
JOIN product AS p ON od.product_sku = p.sku
JOIN customer AS c ON od.customer_id = c.customer_id
WHERE od.order_id = $1
`,[order]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

app.get("/showcart",async(req,res)=>{
    const email = req.query.email;
    try{
       const result = await pool.query(
  `SELECT p.*,c.* FROM Product AS p 
   JOIN addtocart AS c ON p.sku = c.product_sku 
   WHERE c.customer_email = $1`, 
  [email]
);
res.json(result.rows);
    }
    catch (err) {
        console.log(err);
    res.status(500).json({ Error: "Internal Server Error"+err});
  }
})
app.put("/updatequantity",async (req,res)=>{
  const{email,sku,newQty}=req.body;
  console.log(sku)
  try{
    await pool.query(`update addtocart set quantity = $1 where customer_email =$2 and product_sku = $3`,[newQty,email,sku]);
    res.sendStatus(200);
  }
  catch(err){
    res.sendStatus(500);
  }
})

app.post("/checkout", async (req, res) => {
  const { name, email, phone, address } = req.body;
  const payment = "Cash On Delivery";
  try {
    const customerResult = await pool.query(
      `INSERT INTO customer (customer_name, customer_phone, customer_email, customer_address)
       VALUES ($1, $2, $3, $4) RETURNING customer_id`,
      [name, phone, email, address]
    );

    const customer_id = customerResult.rows[0].customer_id;
    const order_date = new Date();
    const cartResult = await pool.query(
      `SELECT product_sku, quantity, color FROM addtocart WHERE customer_email = $1`,
      [email]
    );

    const order =  await pool.query(`INSERT INTO orders (customer_id,order_date,payment_method)
    VALUES ($1, $2, $3) RETURNING order_id`,[customer_id,order_date,payment]);
    const cart = cartResult.rows;
    let order_id = order.rows[0].order_id;
   
    for (let i = 0; i < cart.length; i++) {
      const product_sku = cart[i].product_sku;
      const quantity = cart[i].quantity;
      const color = cart[i].color;

      const productResult = await pool.query(
        `SELECT price FROM Product WHERE sku = $1`,
        [product_sku]
      );

      const price = parseInt(productResult.rows[0].price);
      const total_price = price * quantity;

      await pool.query(
      `INSERT INTO order_detail (order_id,customer_id, product_sku, quantity, price ,color)
       VALUES ($1, $2, $3, $4, $5,$6)`,
      [order_id,customer_id,product_sku, quantity, total_price,color])

    }

    const mailOptions = {
  from: process.env.mail, 
  to: email, 
  subject: 'Order Confirmation - Watch Store',
  html: `
    
    <div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
  <h2 style="color: #2c3e50; text-align: center; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">Thank You for Your Order!</h2>
  
  <p style="font-size: 18px; color: #34495e; margin-top: 20px;">
    <strong>Order ID:</strong> <span style="color: #e67e22;">${order_id}</span>
  </p>
  
  <p style="font-size: 16px; color: #2c3e50; margin-top: 20px;">
    We appreciate your Order and hope you enjoy your purchase. If you have any questions or need assistance, feel free to contact us:
  </p>
  
  <ul style="list-style: none; padding: 0; font-size: 16px; color: #2c3e50; margin-top: 10px;">
    <li><strong>WhatsApp:</strong> <a href="https://wa.me/923314745405" style="color: #27ae60; text-decoration: none;">0331-4745405</a></li>
    <li><strong>Email:</strong> <a href="mailto:cartinix.officials@gmail.com" style="color: #2980b9; text-decoration: none;">cartinix.officials@gmail.com</a></li>
  </ul>

  <p style="margin-top: 30px; font-size: 16px; color: #7f8c8d;">
    Regards, <br>
    <strong style="font-size: 18px; color: #e67e22;">Cartinix</strong>
  </p>
</div>
  `
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Email sending failed:', error);
  } else {
    console.log('Email sent:', info.response);
  }})

    res.json({ order_id });
  } catch (err) {
    console.error("Checkout Error:", err.message);
    res.status(500).json({ error: "Failed to place the order." });
  }
});

app.post("/addtocart",async(req,res)=>{
  const{product_sku,customer_email,color}=req.body;
  try{
    pool.query(`Insert into addtocart (product_sku,customer_email,color) values ($1,$2,$3)`,[product_sku,customer_email,color]);
    res.sendStatus(200);
  }
  catch(err){
    res.sendStatus(500);
  }
})

app.put("/deletecart",async(req,res)=>{
  const {sku,email} = req.body;
  try{
    pool.query(`delete from addtocart where customer_email = $1 and product_sku = $2`,[email,sku]);
    res.sendStatus(200);
  }
  catch(err){
    res.sendStatus(500);
  }
})

app.get("/myorders",async (req,res)=>{
  const email= req.query.email;
  try{
    const result = await pool.query(`SELECT o.status,od.*, p.title, p.image_path FROM order_detail od JOIN product p ON p.sku = od.product_sku join orders as o on od.order_id = o.order_id JOIN customer c ON od.customer_id = c.customer_id WHERE c.customer_email = $1`,[email]);

    res.status(200).json(result.rows);
  }
  catch (err){
    res.status(500).json(err);
  }
})
app.listen(8000,()=>{
    console.log("Code Runing Suceesfully On Port 8000");
})



