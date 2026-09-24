const API_URL = "http://localhost:5000/api";

let cart = [];


/* ===================================
   CART - ADD PRODUCT
=================================== */

async function addProductToCart(productId) {

    const token = localStorage.getItem("shopEasyToken");

    if (!token) {
        alert("Please login before adding products to cart.");
        window.location.href = "login.html";
        return;
    }

    try {

        const response = await fetch(`${API_URL}/cart`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },

            body: JSON.stringify({
                product_id: productId,
                quantity: 1
            })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Unable to add product.");
            return;
        }

        alert("Product added to cart!");

        loadCart();

    } catch (error) {

        console.error("Add to cart error:", error);
        alert("Unable to connect to server.");

    }
}


/* ===================================
   LOAD CART
=================================== */

async function loadCart() {

    const token = localStorage.getItem("shopEasyToken");

    if (!token) {
        return;
    }

    try {

        const response = await fetch(`${API_URL}/cart`, {
            method: "GET",

            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(data.message);
            return;
        }

        const cartItems = document.getElementById("cart-items");
        const cartTotal = document.getElementById("cart-total");
        const cartCount = document.getElementById("cart-count");

        if (!cartItems) {
            return;
        }

        cartItems.innerHTML = "";

        if (!data.items || data.items.length === 0) {

            cartItems.innerHTML = "<p>Your cart is empty.</p>";

        } else {

            data.items.forEach(item => {

                const div = document.createElement("div");

                div.className = "cart-item";

                div.innerHTML = `
    <span>
        ${item.name}
    </span>

    <span>
        Rs. ${item.subtotal}
    </span>

    <div class="quantity-control">

        <button
            type="button"
            onclick="updateCartQuantity(${item.id}, ${Number(item.quantity) - 1})"
            ${Number(item.quantity) <= 1 ? "disabled" : ""}
        >
            −
        </button>

        <span>
            ${item.quantity}
        </span>

        <button
            type="button"
            onclick="updateCartQuantity(${item.id}, ${Number(item.quantity) + 1})"
        >
            +
        </button>

        <button
            type="button"
            onclick="removeCartItem(${item.id})"
        >
            ❌
        </button>

    </div>
`;

                cartItems.appendChild(div);

            });

        }

        if (cartTotal) {
            cartTotal.textContent = data.total || 0;
        }

        if (cartCount) {

            const count = data.items
                ? data.items.reduce(
                    (sum, item) => sum + Number(item.quantity),
                    0
                )
                : 0;

            cartCount.textContent = count;
        }

    } catch (error) {

        console.error("Load cart error:", error);

    }
}

/* ===================================
   UPDATE CART QUANTITY
=================================== */

async function updateCartQuantity(cartItemId, quantity) {

    if (quantity < 1) {
        return;
    }

    const token =
        localStorage.getItem("shopEasyToken");

    if (!token) {
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/cart/${cartItemId}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        `Bearer ${token}`
                },

                body: JSON.stringify({
                    quantity: quantity
                })
            }
        );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to update quantity"
            );

        }

        // Cart dobara load karo
        await loadCart();

    } catch (error) {

        console.error(
            "Update quantity error:",
            error
        );

        alert(error.message);

    }
}

/* ===================================
   REMOVE CART ITEM
=================================== */

async function removeCartItem(itemId) {

    const token = localStorage.getItem("shopEasyToken");

    if (!token) {
        alert("Please login first.");
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/cart/${itemId}`,
            {
                method: "DELETE",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {

            alert(data.message || "Unable to remove item.");
            return;

        }

        loadCart();

    } catch (error) {

        console.error("Remove cart item error:", error);
        alert("Unable to connect to server.");

    }
}


/* ===================================
   CLOSE CART
=================================== */

function closeCart() {

    const modal = document.getElementById("cart-modal");

    if (modal) {
        modal.style.display = "none";
    }

}


/* ===================================
   OPEN CART
=================================== */

function openCart() {

    const modal = document.getElementById("cart-modal");

    if (modal) {

        modal.style.display = "flex";

        loadCart();

    }

}

// ==========================================
// CHECKOUT
// ==========================================

function checkout() {

    const token = localStorage.getItem("shopEasyToken");

    if (!token) {

        alert("Please login first.");

        window.location.href = "login.html";

        return;
    }

    // Go to checkout page
    window.location.href = "checkout.html";
}

/* ===================================
   SEARCH
=================================== */

const search = document.getElementById("search");

if (search) {

    search.addEventListener(
        "input",
        filterProducts
    );

}


/* ===================================
   CATEGORY FILTER
=================================== */

const category = document.getElementById("category");

if (category) {

    category.addEventListener(
        "change",
        filterProducts
    );

}


/* ===================================
   FILTER PRODUCTS
=================================== */

function filterProducts() {

    const searchElement =
        document.getElementById("search");

    const categoryElement =
        document.getElementById("category");

    if (!searchElement || !categoryElement) {
        return;
    }

    const searchValue =
        searchElement.value
            .toLowerCase()
            .trim();

    const categoryValue =
        categoryElement.value;

    const products =
        document.querySelectorAll(".product-card");

    products.forEach(product => {

        const name =
            product.dataset.name
                .toLowerCase();

        const productCategory =
            product.dataset.category;

        const matchesSearch =
            name.includes(searchValue);

        const matchesCategory =
            categoryValue === "all" ||
            productCategory === categoryValue;

        if (
            matchesSearch &&
            matchesCategory
        ) {

            product.style.display = "block";

        } else {

            product.style.display = "none";

        }

    });

}

/* ===================================
   LOAD PRODUCTS FROM DATABASE
=================================== */

async function loadProducts() {

    const container =
        document.getElementById("product-container");

    if (!container) {
        return;
    }

    try {

        const response =
            await fetch(`${API_URL}/products`);

        const products =
            await response.json();

        if (!response.ok) {

            throw new Error(
                products.message ||
                "Unable to load products"
            );

        }

        displayProducts(products);

    } catch (error) {

        console.error(
            "Load products error:",
            error
        );

        container.innerHTML = `
            <p class="error-message">
                Unable to load products.
            </p>
        `;
    }
}


/* ===================================
   DISPLAY PRODUCTS
=================================== */

function displayProducts(products) {

    const container =
        document.getElementById("product-container");

    if (!container) {
        return;
    }

    if (!products || products.length === 0) {

        container.innerHTML =
            "<p>No products available.</p>";

        return;
    }


    container.innerHTML = products.map(product => {

        const categoryName =
            product.category || "N/A";

        const categoryValue =
            categoryName
                .toLowerCase()
                .trim();


        const image =
            product.image_url ||
            "https://via.placeholder.com/500x350?text=No+Image";


        return `

            <div
                class="product-card"
                data-name="${product.name}"
                data-category="${categoryValue}"
            >

                <img
                    src="${image}"
                    alt="${product.name}"
                    onerror="this.src='https://via.placeholder.com/500x350?text=No+Image'"
                >

                <div class="product-info">

                    <h3>
                        ${product.name}
                    </h3>

                    <p class="category">
                        ${categoryName}
                    </p>

                    <p class="price">
                        Rs. ${Number(product.price).toFixed(2)}
                    </p>

                    <button
                        class="add-cart"
                        onclick="addProductToCart(${product.id})"
                    >
                        Add to Cart
                    </button>

                </div>

            </div>

        `;

    }).join("");


    filterProducts();
}


/* ===================================
   LOCAL STORAGE USERS
=================================== */

function getUsers() {

    return JSON.parse(
        localStorage.getItem("shopEasyUsers") || "[]"
    );

}


function saveUsers(users) {

    localStorage.setItem(
        "shopEasyUsers",
        JSON.stringify(users)
    );

}


/* ===================================
   REGISTER
=================================== */

const registerForm =
    document.getElementById("register-form");

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();

            const name =
                document
                    .getElementById("register-name")
                    .value
                    .trim();

            const email =
                document
                    .getElementById("register-email")
                    .value
                    .trim()
                    .toLowerCase();

            const password =
                document
                    .getElementById("register-password")
                    .value;

            const confirmPassword =
                document
                    .getElementById("register-confirm-password")
                    .value;

            const message =
                document.getElementById("register-message");


            /* Check password */

            if (password !== confirmPassword) {

                message.textContent =
                    "Passwords do not match.";

                message.style.display = "block";

                return;
            }


            /* Check password length */

            if (password.length < 6) {

                message.textContent =
                    "Password must contain at least 6 characters.";

                message.style.display = "block";

                return;
            }


            try {

                const response =
                    await fetch(
                        `${API_URL}/register`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                name: name,
                                email: email,
                                password: password
                            })
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    message.textContent =
                        data.message ||
                        "Registration failed.";

                    message.style.display =
                        "block";

                    return;
                }


                message.textContent =
                    "Account created successfully!";

                message.style.display =
                    "block";


                registerForm.reset();


                setTimeout(() => {

                    window.location.href =
                        "login.html";

                }, 1200);


            } catch (error) {

                console.error(
                    "Registration error:",
                    error
                );

                message.textContent =
                    "Unable to connect to server.";

                message.style.display =
                    "block";

            }

        }
    );

}


/* ===================================
   LOGIN
=================================== */

const loginForm =
    document.getElementById("login-form");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();

            const email =
                document
                    .getElementById("login-email")
                    .value
                    .trim()
                    .toLowerCase();

            const password =
                document
                    .getElementById("login-password")
                    .value;

            const message =
                document.getElementById(
                    "login-message"
                );


            try {

                const response =
                    await fetch(
                        `${API_URL}/login`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                email: email,
                                password: password
                            })
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    message.textContent =
                        data.message ||
                        "Login failed.";

                    message.style.display =
                        "block";

                    return;
                }


                /* Save authentication token */

                localStorage.setItem(
                    "shopEasyToken",
                    data.token
                );


                localStorage.setItem(
                    "shopEasyLoggedInUser",
                    JSON.stringify(data.user)
                );


                message.textContent =
                    `Login successful! Welcome back, ${data.user.name}.`;

                message.style.display =
                    "block";


                setTimeout(() => {

                    window.location.href =
                        "index.html";

                }, 1000);


            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );

                message.textContent =
                    "Unable to connect to server.";

                message.style.display =
                    "block";

            }

        }
    );

}


/* ===================================
   PAGE LOAD
=================================== */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        // Load products from database
        loadProducts();

        // Load cart
        loadCart();


        const cartButton =
            document.getElementById("cart-button");


        if (cartButton) {

            cartButton.addEventListener(
                "click",
                openCart
            );

        }

    }
);

// ==========================================
// SHOW ADMIN LINK ONLY FOR ADMIN
// ==========================================

const loggedInUser =
    JSON.parse(
        localStorage.getItem("shopEasyLoggedInUser")
    );

const adminLink =
    document.getElementById("admin-link");

if (
    adminLink &&
    loggedInUser &&
    loggedInUser.role === "admin"
) {
    adminLink.style.display = "block";
}