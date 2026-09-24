const crypto = require("crypto");

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const pool = require("./db");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

// ==========================================
// ESEWA CONFIGURATION
// ==========================================

const ESEWA_PRODUCT_CODE = "EPAYTEST";

const ESEWA_SECRET_KEY =
    "8gBm/:&EnhH.1/q";

const ESEWA_PAYMENT_URL =
    "https://rc-epay.esewa.com.np/api/epay/main/v2/form";

 const ESEWA_STATUS_URL =
    "https://rc.esewa.com.np/api/epay/transaction/status/";

    function generateEsewaSignature(
    totalAmount,
    transactionUuid,
    productCode
) {
    const message =
        `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;

    return crypto
        .createHmac("sha256", ESEWA_SECRET_KEY)
        .update(message)
        .digest("base64");
}
// ==========================================
// Middleware
// ==========================================

app.use(cors());

app.use(express.json());


// Serve frontend files
app.use(express.static(path.join(__dirname, "../frontend")));


// ==========================================
// Test route
// ==========================================

app.get("/api", (req, res) => {

    res.json({
        message: "ShopEasy API is running"
    });

});


// ==========================================
// Authentication middleware
// ==========================================

function authenticateToken(req, res, next) {

    const authHeader = req.headers["authorization"];

    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {

        return res.status(401).json({
            message: "Access token required"
        });

    }

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (err, user) => {

            if (err) {

                return res.status(403).json({
                    message: "Invalid or expired token"
                });

            }

            req.user = user;

            next();

        }
    );

}

function requireAdmin(req, res, next) {

    if (!req.user) {

        return res.status(401).json({
            message: "Authentication required"
        });

    }

    if (req.user.role !== "admin") {

        return res.status(403).json({
            message: "Admin access required"
        });

    }

    next();
}

app.get(
    "/api/admin/test",
    authenticateToken,
    requireAdmin,
    (req, res) => {

        res.json({
            message: "Admin access granted",
            admin: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            }
        });

    }
);




// ==========================================
// REGISTER
// ==========================================

app.post("/api/register", async (req, res) => {

    try {

        const {
            name,
            email,
            password
        } = req.body;

        // Check fields

        if (!name || !email || !password) {

            return res.status(400).json({
                message: "All fields are required"
            });

        }

        // Check password

        if (password.length < 6) {

            return res.status(400).json({
                message: "Password must contain at least 6 characters"
            });

        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        // Check existing user

        const existingUser = await pool.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(email) = $1
            `,
            [cleanEmail]
        );

        if (existingUser.rows.length > 0) {

            return res.status(409).json({
                message: "This email is already registered"
            });

        }

        // Hash password

        const passwordHash = await bcrypt.hash(
            password,
            10
        );

        // Create user

        const result = await pool.query(
            `
            INSERT INTO users
            (
                name,
                email,
                password_hash
            )
            VALUES ($1, $2, $3)
            RETURNING
                id,
                name,
                email,
                created_at
            `,
            [
                cleanName,
                cleanEmail,
                passwordHash
            ]
        );

        return res.status(201).json({

            message: "Account created successfully",

            user: result.rows[0]

        });

    } catch (error) {

        // IMPORTANT:
        // Show the REAL database error in terminal

        console.error("REGISTER ERROR");
        console.error("Message:", error.message);
        console.error("Code:", error.code);
        console.error("Detail:", error.detail);
        console.error("Hint:", error.hint);

        return res.status(500).json({

            message: "Registration failed",
            error: error.message

        });

    }

});
// ==========================================
// LOGIN
// ==========================================

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.status(400).json({
                message: "Email and password are required"
            });

        }


        const result = await pool.query(
            `
            SELECT *
            FROM users
            WHERE email = $1
            `,
            [email.toLowerCase()]
        );


        if (result.rows.length === 0) {

            return res.status(401).json({
                message: "Invalid email or password"
            });

        }


        const user = result.rows[0];


        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password_hash
            );


        if (!passwordMatch) {

            return res.status(401).json({
                message: "Invalid email or password"
            });

        }


        const token = jwt.sign(

    {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
    },

    process.env.JWT_SECRET,

    {
        expiresIn: "1d"
    }

);


        res.json({

            message: "Login successful",

            token,

            user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                     role: user.role
}

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });

    }

});


// ==========================================
// GET ALL PRODUCTS
// ==========================================

app.get("/api/products", async (req, res) => {

    try {

        const {
            search,
            category
        } = req.query;


        let query = `
            SELECT
                p.id,
                p.name,
                p.description,
                p.price,
                p.image_url,
                p.stock,
                c.name AS category
            FROM products p
            LEFT JOIN categories c
                ON p.category_id = c.id
        `;


        const values = [];

        const conditions = [];


        if (search) {

            values.push(`%${search}%`);

            conditions.push(
                `LOWER(p.name) LIKE LOWER($${values.length})`
            );

        }


        if (
            category &&
            category !== "all"
        ) {

            values.push(category);

            conditions.push(
                `c.name = $${values.length}`
            );

        }


        if (conditions.length > 0) {

            query +=
                " WHERE " +
                conditions.join(" AND ");

        }


        query += " ORDER BY p.id";


        const result = await pool.query(
            query,
            values
        );


        res.json(result.rows);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Unable to get products"
        });

    }

});

app.post(
    "/api/admin/products",
    authenticateToken,
    requireAdmin,
    async (req, res) => {

        try {

            const {
                category_id,
                name,
                description,
                price,
                image_url,
                stock
            } = req.body;

            if (
                !category_id ||
                !name ||
                price === undefined ||
                stock === undefined
            ) {
                return res.status(400).json({
                    message: "Category, name, price and stock are required"
                });
            }

            const categoryResult = await pool.query(
                `
                SELECT id
                FROM categories
                WHERE id = $1
                `,
                [category_id]
            );

            if (categoryResult.rows.length === 0) {
                return res.status(400).json({
                    message: "Invalid category"
                });
            }

            const result = await pool.query(
                `
                INSERT INTO products
                (
                    category_id,
                    name,
                    description,
                    price,
                    image_url,
                    stock
                )
                VALUES
                ($1, $2, $3, $4, $5, $6)
                RETURNING *
                `,
                [
                    category_id,
                    name,
                    description || "",
                    price,
                    image_url || "",
                    stock
                ]
            );

            res.status(201).json({
                message: "Product added successfully",
                product: result.rows[0]
            });

        } catch (error) {

            console.error("Add product error:", error);

            res.status(500).json({
                message: "Unable to add product"
            });

        }

    }
);

app.delete(
    "/api/admin/products/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {

        try {

            const { id } = req.params;

            const result = await pool.query(
                `
                DELETE FROM products
                WHERE id = $1
                RETURNING *
                `,
                [id]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    message: "Product not found"
                });

            }

            res.json({
                message: "Product deleted successfully",
                product: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Delete product error:",
                error
            );

            res.status(500).json({
                message: "Unable to delete product"
            });

        }

    }
);

app.put(
    "/api/admin/products/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {

        try {

            const { id } = req.params;

            const {
                category_id,
                name,
                description,
                price,
                image_url,
                stock
            } = req.body;


            if (
                !category_id ||
                !name ||
                price === undefined ||
                stock === undefined
            ) {

                return res.status(400).json({
                    message: "Category, name, price and stock are required"
                });

            }


            const categoryResult = await pool.query(
                `
                SELECT id
                FROM categories
                WHERE id = $1
                `,
                [category_id]
            );


            if (categoryResult.rows.length === 0) {

                return res.status(400).json({
                    message: "Invalid category"
                });

            }


            const result = await pool.query(
                `
                UPDATE products
                SET
                    category_id = $1,
                    name = $2,
                    description = $3,
                    price = $4,
                    image_url = $5,
                    stock = $6
                WHERE id = $7
                RETURNING *
                `,
                [
                    category_id,
                    name,
                    description || "",
                    price,
                    image_url || "",
                    stock,
                    id
                ]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message: "Product not found"
                });

            }


            res.json({
                message: "Product updated successfully",
                product: result.rows[0]
            });


        } catch (error) {

            console.error(
                "Update product error:",
                error
            );

            res.status(500).json({
                message: "Unable to update product"
            });

        }

    }
);


// ==========================================
// GET SINGLE PRODUCT
// ==========================================

app.get("/api/products/:id", async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT
                p.id,
                p.name,
                p.description,
                p.price,
                p.image_url,
                p.stock,
                c.name AS category
            FROM products p
            LEFT JOIN categories c
                ON p.category_id = c.id
            WHERE p.id = $1
            `,
            [req.params.id]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message: "Product not found"
            });

        }


        res.json(result.rows[0]);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Server error"
        });

    }

});


// ==========================================
// GET / CREATE CART
// ==========================================

async function getOrCreateCart(userId) {

    let result = await pool.query(
        `
        SELECT id
        FROM carts
        WHERE user_id = $1
        `,
        [userId]
    );


    if (result.rows.length > 0) {

        return result.rows[0].id;

    }


    result = await pool.query(
        `
        INSERT INTO carts (user_id)
        VALUES ($1)
        RETURNING id
        `,
        [userId]
    );


    return result.rows[0].id;

}


// ==========================================
// GET CART
// ==========================================

app.get(
    "/api/cart",
    authenticateToken,
    async (req, res) => {

        try {

            const cartId =
                await getOrCreateCart(req.user.id);


            const result = await pool.query(
                `
                SELECT
                    ci.id,
                    ci.product_id,
                    ci.quantity,
                    p.name,
                    p.price,
                    p.image_url,
                    p.stock,
                    (p.price * ci.quantity) AS subtotal
                FROM cart_items ci
                JOIN products p
                    ON ci.product_id = p.id
                WHERE ci.cart_id = $1
                ORDER BY ci.id
                `,
                [cartId]
            );


            let total = 0;


            result.rows.forEach(item => {

                total += Number(item.subtotal);

            });


            res.json({

                items: result.rows,

                total

            });


        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Unable to get cart"
            });

        }

    }
);


// ==========================================
// ADD TO CART
// ==========================================

app.post(
    "/api/cart",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                product_id,
                quantity = 1
            } = req.body;


            const product = await pool.query(
                `
                SELECT *
                FROM products
                WHERE id = $1
                `,
                [product_id]
            );


            if (product.rows.length === 0) {

                return res.status(404).json({
                    message: "Product not found"
                });

            }


            if (
                product.rows[0].stock <
                quantity
            ) {

                return res.status(400).json({
                    message: "Not enough stock"
                });

            }


            const cartId =
                await getOrCreateCart(req.user.id);


            await pool.query(
                `
                INSERT INTO cart_items
                (cart_id, product_id, quantity)
                VALUES ($1, $2, $3)

                ON CONFLICT (cart_id, product_id)

                DO UPDATE SET
                    quantity =
                    cart_items.quantity + EXCLUDED.quantity
                `,
                [
                    cartId,
                    product_id,
                    quantity
                ]
            );


            await pool.query(
                `
                UPDATE carts
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [cartId]
            );


            res.json({
                message: "Product added to cart"
            });


        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Unable to add product"
            });

        }

    }
);


// ==========================================
// REMOVE CART ITEM
// ==========================================

app.delete(
    "/api/cart/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const cartId =
                await getOrCreateCart(req.user.id);


            await pool.query(
                `
                DELETE FROM cart_items
                WHERE id = $1
                AND cart_id = $2
                `,
                [
                    req.params.id,
                    cartId
                ]
            );


            res.json({
                message: "Item removed"
            });


        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Unable to remove item"
            });

        }

    }
);

// ==========================================
// UPDATE CART ITEM QUANTITY
// ==========================================

app.put(
    "/api/cart/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const cartId =
                await getOrCreateCart(req.user.id);

            const quantity =
                Number(req.body.quantity);


            if (
                !Number.isInteger(quantity) ||
                quantity < 1
            ) {

                return res.status(400).json({
                    message: "Invalid quantity"
                });

            }


            const result = await pool.query(
                `
                UPDATE cart_items
                SET quantity = $1
                WHERE id = $2
                AND cart_id = $3
                RETURNING *
                `,
                [
                    quantity,
                    req.params.id,
                    cartId
                ]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message: "Cart item not found"
                });

            }


            res.json({
                message: "Cart quantity updated",
                item: result.rows[0]
            });


        } catch (error) {

            console.error(
                "Update cart quantity error:",
                error
            );


            res.status(500).json({
                message: "Unable to update cart quantity"
            });

        }

    }
);


// ==========================================
// CHECKOUT
// ==========================================

app.post(
    "/api/checkout",
    authenticateToken,
    async (req, res) => {

        const client =
            await pool.connect();


        try {
        const {
    shipping_name,
    shipping_phone,
    shipping_address,
    shipping_city,
    shipping_district,
    shipping_ward,
    shipping_pincode,
    payment_method
} = req.body;
            

            await client.query("BEGIN");


            const cartResult =
                await client.query(
                    `
                    SELECT
                        ci.product_id,
                        ci.quantity,
                        p.price,
                        p.stock
                    FROM cart_items ci
                    JOIN carts c
                        ON ci.cart_id = c.id
                    JOIN products p
                        ON ci.product_id = p.id
                    WHERE c.user_id = $1
                    FOR UPDATE
                    `,
                    [req.user.id]
                );


            if (cartResult.rows.length === 0) {

                await client.query("ROLLBACK");

                return res.status(400).json({
                    message: "Cart is empty"
                });

            }


            let total = 0;


            for (const item of cartResult.rows) {

                if (
                    item.quantity >
                    item.stock
                ) {

                    await client.query("ROLLBACK");

                    return res.status(400).json({
                        message:
                            "Insufficient stock for product"
                    });

                }


                total +=
                    Number(item.price) *
                    item.quantity;

            }


  const orderResult =
    await client.query(
        `
        INSERT INTO orders
        (
            user_id,
            total_amount,
            status,
            payment_method,
            shipping_name,
            shipping_phone,
            shipping_address,
            shipping_city,
            shipping_district,
            shipping_ward,
            shipping_pincode
        )
        VALUES
        (
            $1,
            $2,
            'pending',
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10
        )
        RETURNING
            id,
            total_amount,
            status,
            payment_method,
            shipping_name,
            shipping_phone,
            shipping_address,
            shipping_city,
            shipping_district,
            shipping_ward,
            shipping_pincode,
            created_at
        `,
        [
            req.user.id,
            total,
            payment_method,
            shipping_name,
            shipping_phone,
            shipping_address,
            shipping_city,
            shipping_district,
            shipping_ward,
            shipping_pincode
        ]
    );

            const order =
                orderResult.rows[0];

for (
    const item
    of cartResult.rows
) {

    await client.query(
        `
        INSERT INTO order_items
        (
            order_id,
            product_id,
            quantity,
            price
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
            order.id,
            item.product_id,
            item.quantity,
            item.price
        ]
    );


    await client.query(
        `
        UPDATE products
        SET stock = stock - $1
        WHERE id = $2
        `,
        [
            item.quantity,
            item.product_id
        ]
    );

}
            await client.query(
    `
    DELETE FROM cart_items
    WHERE cart_id = (
        SELECT id
        FROM carts
        WHERE user_id = $1
    )
    `,
    [req.user.id]
);

// ==========================================
// ESEWA TRANSACTION ID
// ==========================================

let transactionUuid = null;

if (payment_method === "esewa") {

    transactionUuid =
        `ORDER-${order.id}-${Date.now()}`;

    await client.query(
        `
        UPDATE orders
        SET payment_transaction_id = $1
        WHERE id = $2
        `,
        [
            transactionUuid,
            order.id
        ]
    );
}


// COMMIT
await client.query("COMMIT");

             // ==========================================
              // ESEWA PAYMENT
              // ==========================================

                if (payment_method === "esewa") {

    
         const totalAmount =
        Number(order.total_amount).toFixed(2);

    const signature =
        generateEsewaSignature(
            totalAmount,
            transactionUuid,
            ESEWA_PRODUCT_CODE
        );


    return res.status(201).json({

        message: "Proceed to eSewa payment",

        paymentRequired: true,

        paymentUrl: ESEWA_PAYMENT_URL,

        paymentData: {

            amount: totalAmount,

            tax_amount: "0",

            total_amount: totalAmount,

            transaction_uuid:
                transactionUuid,

            product_code:
                ESEWA_PRODUCT_CODE,

            product_service_charge: "0",

            product_delivery_charge: "0",

            success_url:
                "http://localhost:5000/api/payment/esewa/success",

            failure_url:
                "http://localhost:5000/api/payment/esewa/failure",

            signed_field_names:
                "total_amount,transaction_uuid,product_code",

            signature:
                signature
        },

        order

    });

}



// ==========================================
// COD
// ==========================================

return res.status(201).json({

    message: "Checkout successful",

    paymentRequired: false,

    order

});


        } catch (error) {

            await client.query("ROLLBACK");

            console.error(error);

            res.status(500).json({
                message: "Checkout failed"
            });

        } finally {

            client.release();

        }

    }
);

// ==========================================
// ESEWA PAYMENT VERIFICATION
// ==========================================

app.get(
    "/api/payment/esewa/verify/:orderId",
    async (req, res) => {

        try {

            const orderId = req.params.orderId;

            const result = await pool.query(
                `
                SELECT
                    id,
                    total_amount,
                    payment_method,
                    payment_transaction_id,
                    payment_status
                FROM orders
                WHERE id = $1
                `,
                [orderId]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    message: "Order not found"
                });

            }

            const order = result.rows[0];

            if (order.payment_method !== "esewa") {

                return res.status(400).json({
                    message: "This order is not an eSewa order"
                });

            }

            if (!order.payment_transaction_id) {

                return res.status(400).json({
                    message: "eSewa transaction ID not found"
                });

            }

            const totalAmount =
                Number(order.total_amount).toFixed(2);

            const verifyUrl =
                `${ESEWA_STATUS_URL}?product_code=${encodeURIComponent(ESEWA_PRODUCT_CODE)}&total_amount=${encodeURIComponent(totalAmount)}&transaction_uuid=${encodeURIComponent(order.payment_transaction_id)}`;

            const response =
                await fetch(verifyUrl);

            const data =
                await response.json();

            console.log(
                "eSewa verification:",
                data
            );

            if (data.status === "COMPLETE") {

                await pool.query(
                    `
                    UPDATE orders
                    SET
                        payment_status = 'Completed',
                        payment_reference = $1,
                        status = 'confirmed'
                    WHERE id = $2
                    `,
                    [
                        data.ref_id,
                        order.id
                    ]
                );

                return res.json({
                    success: true,
                    message: "Payment verified successfully",
                    status: "COMPLETE",
                    reference: data.ref_id
                });

            }

            return res.json({
                success: false,
                status: data.status,
                message: "Payment is not completed yet"
            });

        } catch (error) {

            console.error(
                "eSewa verification error:",
                error
            );

            res.status(500).json({
                message: "Payment verification failed"
            });

        }
    }
);
// ==========================================
// ESEWA SUCCESS + VERIFICATION
// ==========================================

app.get(
    "/api/payment/esewa/success",
    async (req, res) => {

        try {

            console.log(
                "eSewa success response:",
                req.query
            );

            const encodedData = req.query.data;

            if (!encodedData) {

                return res.status(400).send(`
                    <h1>Payment Verification Failed</h1>
                    <p>eSewa response data was not received.</p>
                    <a href="/orders.html">
                        View My Orders
                    </a>
                `);

            }

            // Decode eSewa Base64 response
            const decodedData =
                Buffer.from(
                    encodedData,
                    "base64"
                ).toString("utf8");

            const paymentData =
                JSON.parse(decodedData);

            console.log(
                "Decoded eSewa response:",
                paymentData
            );

            const transactionUuid =
                paymentData.transaction_uuid;

            const transactionCode =
                paymentData.transaction_code;

            const paymentStatus =
                paymentData.status;

            if (!transactionUuid) {

                return res.status(400).send(`
                    <h1>Payment Verification Failed</h1>
                    <p>Transaction ID was not received.</p>
                `);

            }

            // Find order using transaction UUID
            const orderResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        total_amount,
                        payment_method,
                        payment_status,
                        payment_transaction_id
                    FROM orders
                    WHERE payment_transaction_id = $1
                    `,
                    [transactionUuid]
                );

            if (orderResult.rows.length === 0) {

                return res.status(404).send(`
                    <h1>Order Not Found</h1>
                    <p>Unable to find the related order.</p>
                `);

            }

            const order =
                orderResult.rows[0];

            // ------------------------------------------
            // Check eSewa response status
            // ------------------------------------------

            if (paymentStatus !== "COMPLETE") {

                return res.send(`
                    <h1>Payment Not Completed</h1>
                    <p>eSewa payment status: ${paymentStatus}</p>
                    <a href="/orders.html">
                        View My Orders
                    </a>
                `);

            }

            // ------------------------------------------
            // Verify payment with eSewa
            // ------------------------------------------

            const totalAmount =
                Number(order.total_amount).toFixed(2);

            const verifyUrl =
                `${ESEWA_STATUS_URL}?product_code=${encodeURIComponent(ESEWA_PRODUCT_CODE)}&total_amount=${encodeURIComponent(totalAmount)}&transaction_uuid=${encodeURIComponent(transactionUuid)}`;

            const verifyResponse =
                await fetch(verifyUrl);

            const verifyData =
                await verifyResponse.json();

            console.log(
                "eSewa verification result:",
                verifyData
            );

            // ------------------------------------------
            // PAYMENT SUCCESS
            // ------------------------------------------

            if (verifyData.status === "COMPLETE") {

                await pool.query(
                    `
                    UPDATE orders
                    SET
                        payment_status = 'Completed',
                        payment_reference = $1,
                        status = 'confirmed'
                    WHERE id = $2
                    `,
                    [
                        verifyData.ref_id,
                        order.id
                    ]
                );

                return res.send(`
                    <h1>Payment Successful</h1>

                    <p>
                        Your eSewa payment was successfully verified.
                    </p>

                    <p>
                        Order #${order.id}
                    </p>

                    <p>
                        Transaction: ${transactionCode || transactionUuid}
                    </p>

                    <a href="/orders.html">
                        View My Orders
                    </a>
                `);

            }

            // ------------------------------------------
            // PAYMENT NOT COMPLETE
            // ------------------------------------------

            return res.send(`
                <h1>Payment Verification Pending</h1>

                <p>
                    eSewa status: ${verifyData.status}
                </p>

                <a href="/orders.html">
                    View My Orders
                </a>
            `);

        } catch (error) {

            console.error(
                "eSewa success verification error:",
                error
            );

            res.status(500).send(`
                <h1>Payment Verification Failed</h1>

                <p>
                    Something went wrong while verifying payment.
                </p>

                <a href="/orders.html">
                    View My Orders
                </a>
            `);

        }

    }
);
// ==========================================
// ESEWA FAILURE
// ==========================================

app.get(
    "/api/payment/esewa/failure",
    async (req, res) => {

        console.log(
            "eSewa payment failed:",
            req.query
        );

        res.send(`
            <h1>Payment Failed</h1>
            <p>Your eSewa payment was cancelled or failed.</p>
            <a href="/checkout.html">
                Back to Checkout
            </a>
        `);

    }
);

// ==========================================
// GET USER ORDERS
// ==========================================

app.get(
    "/api/orders",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        total_amount,
                        status,
                        created_at
                    FROM orders
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    `,
                    [req.user.id]
                );


            res.json(result.rows);


        } catch (error) {

            console.error(error);

            res.status(500).json({
                message: "Unable to get orders"
            });

        }

    }
);

// ==========================================
// GET SINGLE ORDER DETAILS
// ==========================================

app.get(
    "/api/orders/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const orderId = req.params.id;

            const orderResult = await pool.query(
                `
               SELECT
                   id,
                   total_amount,
                   status,
                    shipping_name,
                    shipping_phone,
                    shipping_address,
                    shipping_city,
                    shipping_district,
                    shipping_ward,
                    shipping_pincode,
                    payment_method,
                    created_at
                   
                FROM orders
                WHERE id = $1
                AND user_id = $2
                `,
                [orderId, req.user.id]
            );

            if (orderResult.rows.length === 0) {

                return res.status(404).json({
                    message: "Order not found"
                });

            }

            const order = orderResult.rows[0];

            const itemsResult = await pool.query(
                `
                SELECT
                    oi.id,
                    oi.product_id,
                    oi.quantity,
                    oi.price,
                    p.name,
                    p.image_url,
                    (oi.quantity * oi.price) AS subtotal
                FROM order_items oi
                JOIN products p
                    ON oi.product_id = p.id
                WHERE oi.order_id = $1
                ORDER BY oi.id
                `,
                [orderId]
            );

            res.json({
                order: order,
                items: itemsResult.rows
            });

        } catch (error) {

            console.error(
                "Order details error:",
                error
            );

            res.status(500).json({
                message: "Unable to get order details"
            });

        }

    }
);


// ==========================================
// ADMIN - GET ALL ORDERS
// ==========================================

app.get(
    "/api/admin/orders",
    authenticateToken,
    requireAdmin,
    async (req, res) => {

        try {

            const result = await pool.query(
                `
                SELECT
                    o.id,
                    o.user_id,
                    o.total_amount,
                    o.status,
                    o.shipping_name,
                    o.shipping_phone,
                    o.shipping_address,
                    o.shipping_city,
                    o.shipping_district,
                    o.shipping_ward,
                    o.shipping_pincode,
                    o.created_at,
                    u.email
                FROM orders o
                JOIN users u
                    ON o.user_id = u.id
                ORDER BY o.created_at DESC
                `
            );

            res.json(result.rows);

        } catch (error) {

            console.error(
                "Admin orders error:",
                error
            );

            res.status(500).json({
                message: "Unable to get orders"
            });

        }

    }
);

// ==========================================
// ADMIN - GET ALL USERS
// ==========================================

app.get(
    "/api/admin/users",
    authenticateToken,
    requireAdmin,
    async (req, res) => {

        try {

            const result = await pool.query(
                `
                SELECT
                    id,
                    name,
                    email,
                    role,
                    created_at
                FROM users
                ORDER BY created_at DESC
                `
            );

            res.json(result.rows);

        } catch (error) {

            console.error(
                "Admin users error:",
                error
            );

            res.status(500).json({
                message: "Unable to get users"
            });

        }

    }
);
app.get(
    "/api/admin/stats",
    authenticateToken,
    requireAdmin,
    async (req, res) => {

        try {

            const productsResult = await pool.query(`
                SELECT COUNT(*) AS total
                FROM products
            `);

            const ordersResult = await pool.query(`
                SELECT
                    COUNT(*) AS total_orders,
                    COALESCE(SUM(total_amount), 0) AS total_sales
                FROM orders
            `);

            const usersResult = await pool.query(`
                SELECT COUNT(*) AS total
                FROM users
            `);

            res.json({
                totalProducts:
                    Number(productsResult.rows[0].total),

                totalOrders:
                    Number(ordersResult.rows[0].total_orders),

                totalUsers:
                    Number(usersResult.rows[0].total),

                totalSales:
                    Number(ordersResult.rows[0].total_sales)
            });

        } catch (error) {

            console.error(
                "Admin stats error:",
                error
            );

            res.status(500).json({
                message: "Unable to get dashboard stats"
            });

        }

    }
);

// ==========================================
// ADMIN - UPDATE ORDER STATUS
// ==========================================

app.put(
    "/api/admin/orders/:id/status",
    authenticateToken,
    requireAdmin,
    async (req, res) => {

        try {

            const orderId = req.params.id;
            const { status } = req.body;


            const allowedStatuses = [
                "Pending",
                "Processing",
                "Shipped",
                "Delivered"
            ];


            if (!allowedStatuses.includes(status)) {

                return res.status(400).json({
                    message: "Invalid order status"
                });

            }


            const result = await pool.query(
                `
                UPDATE orders
                SET status = $1
                WHERE id = $2
                RETURNING *
                `,
                [
                    status,
                    orderId
                ]
            );


            if (result.rows.length === 0) {

                return res.status(404).json({
                    message: "Order not found"
                });

            }


            res.json({
                message: "Order status updated successfully",
                order: result.rows[0]
            });


        } catch (error) {

            console.error(
                "Update order status error:",
                error
            );

            res.status(500).json({
                message: "Unable to update order status"
            });

        }

    }
);
// ==========================================
// Start server
// ==========================================

const server = app.listen(PORT, () => {
    console.log(
        `ShopEasy server running at http://localhost:${PORT}`
    );
});

server.on("error", (error) => {
    console.error("SERVER ERROR:");
    console.error(error);
});

process.on("uncaughtException", (error) => {
    console.error("UNCAUGHT EXCEPTION:");
    console.error(error);
});

process.on("unhandledRejection", (error) => {
    console.error("UNHANDLED REJECTION:");
    console.error(error);
});