const express = require ("express");
const cors = require ("cors");
const {Pool} = require ("pg");
const bcrypt = require ("bcrypt");
require("dotenv").config();
const app = express();
app.use(express.json());
app.use(cors());
app.use("/photos", express.static("photos"));

const path = require ("path");
const multer = require ("multer");
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
    console.log(req.body);
    const {name,email,password} = req.body;
    try{
        const hashedpassword = await bcrypt.hash(password,10);
        await pool.query(`insert into admin (name,email,password) values ($1,$2,$3)`,[name,email,hashedpassword]);
        res.status(200).json({message  :"Your Sign-Up Application Has Been Accepted"});
    }
    catch(err){
        res.status(500).json({error: "Your Sign-Up Application Has Been Rejected For Reason"+err});
    }
})

app.post("/customerSignup",async(req,res)=>{
    const {name,email,password} = req.body;
    try{
        const hashedpassword = await bcrypt.hash(password,10);
        await pool.query(`insert into customer (name,email,password) values ($1,$2,$3)`,[name,email,hashedpassword]);
        res.status(200).json("Your Sign-Up Application Has Been Accepted");
    }
    catch(err){
        res.status(500).json("Your Sign-Up Application Has Been Rejected For Reason"+err);
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

app.post("/customerSignin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(`SELECT * FROM customer WHERE email = $1`, [email]);

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
app.post("/listingproduct", upload.any(), async (req, res) => {
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

    const mainImage = req.files.find(f => f.fieldname === "main_image")?.filename;

    // Insert into Product table
    await pool.query(
      `INSERT INTO Product (sku, title, description, brand, category, material_type, stock, price, image_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [sku, title, description, brand, category, material, stock, price, mainImage]
    );

    const colorImages = req.files.filter(f => f.fieldname === "color_images[]");
    const {color_names:colorNames } = req.body;
    for (let i = 0; i < colorNames.length; i++) {
      const color = colorNames[i];
      const image = colorImages[i]?.filename;


      await pool.query(
        `INSERT INTO ProductColors (sku, color_name) VALUES ($1, $2)`,
        [sku, color]
      );

      await pool.query(
        `INSERT INTO ProductImages (sku, color_name, image_path) VALUES ($1, $2, $3)`,
        [sku, color, image]
      );
    }

    res.status(200).json({ message: "Product listed successfully." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ Error: "Server error" });
  }
});


app.put('/price&stock',async (req,res)=>{
    const {stock,price,sku} = req.body;
    try{
         if (stock !== undefined && price === undefined) {
          const result = await pool.query(`select price from Product where sku = $1`,[sku]);
          price = result.rows[0].price;
      await pool.query(`UPDATE Product SET stock = $1, price = $2 WHERE sku = $3`, [stock,price,sku]);
   } 
    else if (price !== undefined && stock === undefined) {
      const result = await pool.query(`select stock from Product where sku = $1`,[sku]);
      stock = result.rows[0].price;  
      await pool.query(`UPDATE Product SET stock = $1,price = $2 WHERE sku = $3`, [stock,price, sku]);
    } 
    else if (price !== undefined && stock !== undefined) {
      await pool.query(`UPDATE Product SET stock = $1, price = $2 WHERE sku = $3`, [stock, price, sku]);
    }
    else{
        return res.status(500).json({Error : "Enter Correct Data"})
    }
    res.json({ message: "Data Updated Successfully" });
    }
    catch(err){
        res.json({Error : "Error Uploading data"+err});
    }
})

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
      SELECT p.sku,p.image_path, p.title, p.brand,o.status,o.order_id,o.price, o.quantity
      FROM Product AS p
      JOIN Order_Detail AS o ON o.product_sku = p.sku
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
      SELECT c.customer_name,c.customer_address,c.customer_phone,c.customer_email,p.sku,p.image_path, p.title,o.order_id,o.order_date, o.price, o.quantity
      FROM Product AS p
      JOIN Order_Detail AS o ON o.product_sku = p.sku
      Join customer as c on c.customer_id = o.customer_id where o.product_sku = $1 and o.order_id = $2
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
       await pool.query(`Update Order_Detail set status = $1 where order_id = $2`,[ship,orderid]);
        res.json({message : "Order Has Been Shipped"});
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

   const order =  await pool.query(
      `INSERT INTO order_detail (customer_id, product_sku, quantity, price, order_date,color,payment_method)
       VALUES ($1, $2, $3, $4, $5,$6,$7) RETURNING order_id`,
      [customer_id, sku, quantity, total_price, order_date,color,payment]
    );
    const order_id = order.rows[0].order_id;
    res.json({order_id});
  } catch (err) {
    console.error("Order Error:", err.message);
    res.status(500).json({ error: "There was an issue placing the order." });
  }
});

app.get("/orderslip", async (req, res) => {
  const { orderid } = req.query;

  try {
    const result = await pool.query(
      `SELECT o.order_id,o.product_sku,o.customer_id,o.quantity,o.price,o.color,o.payment_method,o.status,o.order_date,p.title,p.sku,p.image_path,c.customer_name,c.customer_email,c.customer_phone, c.customer_address
       FROM Order_Detail o
       JOIN Product p ON o.product_sku = p.sku
       JOIN customer c ON o.customer_id = c.customer_id
       WHERE o.order_id = $1`,
      [orderid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

app.listen(8000,()=>{
    console.log("Code Runing Suceesfully On Port 8000");
})



