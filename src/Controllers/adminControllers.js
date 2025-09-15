import pool from "../Model/Model.js";
import bcrypt from 'bcrypt'
export const adminSignin = async (req, res) => {
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
}

export const productDetails = async (req, res) => {
  const productid = req.query.productid;
  try {
    const result = await pool.query(`select * from Product where sku= $1`, [productid]);

    const image = await pool.query(`select image_path from ProductImages where sku = $1`, [productid]);
    const color = await pool.query(`select color_name from  ProductColors where sku = $1`, [productid]);

    res.json({
      details: result.rows[0],
      images: image.rows,
      color: color.rows
    })
  }
  catch (err) {
    res.json({ Error: "Error Fetching Data" });
  }
}

export const productListing = async (req, res) => {
  try {
    const { sku, title, description, brand, category, material, stock, price } = req.body;

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
}

export const details = async (req, res) => {
  try {
    const result = await pool.query(`select * from Product`);
    res.json(result.rows)
  }
  catch (err) {
    res.json({ Error: "Error Fetching Data" });
  }
}

export const editProduct = async (req, res) => {
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
}

export const getOrder = async (req, res) => {
  try {
    const result = await pool.query(`
     SELECT p.sku, p.image_path, p.title, p.brand, od.order_id, od.price, od.quantity, o.status FROM product AS p JOIN order_detail AS od ON od.product_sku = p.sku JOIN orders AS o ON o.order_id = od.order_id;
    `);
    const grouped = {};
    result.rows.forEach(row => {
      if (!grouped[row.order_id]) {
        grouped[row.order_id] = {
          order_id: row.order_id,
          status: row.status,
          items: []
        };
      }
      grouped[row.order_id].items.push({
        title: row.title,
        quantity: row.quantity,
        price: row.price,
        image_path: row.image_path
      });
    });
    res.json(Object.values(grouped));
  } catch (err) {
    res.json({ Error: "Error Fetching Data: " + err });
  }
}

export const orderDetail = async (req, res) => {
  const orderid = req.query.orderid;
  try {
    const result = await pool.query(`
      SELECT 
        c.customer_name, c.customer_address, c.customer_phone, c.customer_email,
        p.sku, p.image_path, p.title, p.brand,
        o.order_id, o.order_date, o.status,
        od.price, od.quantity
      FROM product AS p
      JOIN order_detail AS od ON od.product_sku = p.sku
      JOIN orders AS o ON o.order_id = od.order_id
      JOIN customer AS c ON c.customer_id = o.customer_id
      WHERE o.order_id = $1
    `, [orderid]);

    if (result.rows.length === 0) {
      return res.json({ Error: "Wrong Order Id" });
    }

    // 🔹 Group just like getOrder
    const grouped = {};
    result.rows.forEach(row => {
      if (!grouped[row.order_id]) {
        grouped[row.order_id] = {
          order_id: row.order_id,
          order_date: row.order_date,
          status: row.status,
          customer: {
            name: row.customer_name,
            address: row.customer_address,
            phone: row.customer_phone,
            email: row.customer_email
          },
          items: []
        };
      }
      grouped[row.order_id].items.push({
        sku: row.sku,
        title: row.title,
        brand: row.brand,
        price: row.price,
        quantity: row.quantity,
        image_path: row.image_path
      });
    });

    res.json(Object.values(grouped));
  } catch (err) {
    res.json({ Error: "Error Fetching Data: " + err });
  }
};


export const Ship = async (req, res) => {
  const ship = 'shipped';
  const orderid = req.body.orderid;
  const order = parseInt(orderid);
  try {
    await pool.query(`Update orders set status = $1 where order_id = $2`, [ship, orderid]);
    res.json({ message: "Order Has Been Shipped" });
  }
  catch (err) {
    res.json({ Error: "Error :" + err });
  }
}

export const Deliver = async (req, res) => {
  const deliver = 'delivered';
  const orderid = req.body.orderid;
  const order = parseInt(orderid);
  try {
    await pool.query(`Update orders set status = $1 where order_id = $2`, [deliver, orderid]);
    res.json({ message: "Order Has Been delivered" });
  }
  catch (err) {
    res.json({ Error: "Error :" + err });
  }
}

export const remove = async (req, res) => {
  const sku  = req.body.productid;
  console.log(sku);
  try {
     await pool.query(`DELETE FROM ProductColors WHERE sku = $1`, [sku]);
    await pool.query(`DELETE FROM ProductImages WHERE sku = $1`, [sku]);
    await pool.query(`DELETE FROM Product WHERE sku = $1`, [sku]);
    res.status(200).json({message:"Product Has Been Delete"});
  }
  catch (err) {
    console.log(err);
    res.status(500).json({error:"Error Deleteing Product"+err});
  }
}

export const updateQuantity = async (req, res) => {
  const { email, sku, newQty } = req.body;
  console.log(sku)
  try {
    await pool.query(`update addtocart set quantity = $1 where customer_email =$2 and product_sku = $3`, [newQty, email, sku]);
    res.sendStatus(200);
  }
  catch (err) {
    res.sendStatus(500);
  }
}

export const priceStock = async (req, res) => {
  let { stock, price, sku } = req.body; 
  
  try {
    if (stock !== null && price === null) {
      const result = await pool.query(`SELECT price FROM Product WHERE sku = $1`, [sku]);
      price = result.rows[0].price; 
      await pool.query(`UPDATE Product SET stock = $1, price = $2 WHERE sku = $3`, [stock, price, sku]);
    } 
    else if (price !== null && stock === null) {
      const result = await pool.query(`SELECT stock FROM Product WHERE sku = $1`, [sku]);
      stock = result.rows[0].stock; 
      await pool.query(`UPDATE Product SET stock = $1, price = $2 WHERE sku = $3`, [stock, price, sku]);
    } 
    else if (price !== null && stock !== null) {
      await pool.query(`UPDATE Product SET stock = $1, price = $2 WHERE sku = $3`, [stock, price, sku]);
    } 
    else {
      return res.status(400).json({ Error: "Enter Correct Data" });
    }

    res.json({ message: "Data Updated Successfully" });
  } catch (err) {
    res.status(500).json({ Error: "Error Uploading data: " + err.message });
  }
};
