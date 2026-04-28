# 🛒 Grocery Store Web Application

A full-stack web application that allows users to browse grocery products, place orders, manage carts, and interact with store owners. This version of the project uses **MongoDB** as the database for flexible and scalable data storage.

---

## 📌 Features

### 👤 Customer Side

* User Registration & Login
* Browse Stores & Products
* Add to Cart
* Place Orders
* Manage Addresses
* View Order History
* Submit Complaints

### 🧑‍💼 Store Owner Side

* Owner Registration & Login
* Add / Manage Products
* View Orders
* Accept / Reject Orders
* Dashboard Management

---

## 🛠️ Tech Stack

**Frontend**

* HTML
* CSS
* JavaScript

**Backend**

* Node.js
* Express.js

**Database**

* MongoDB

**Other Tools**

* dotenv (for environment variables)
* multer (for file uploads)
* cors
* mongoose (MongoDB ODM)

---

## 📁 Project Structure

```
grocery_store_project_mongodb/
│
├── public/                # Frontend files (HTML, CSS, JS)
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── cart.html
│   ├── owner-dashboard.html
│   └── ...
│
├── models/                # Mongoose schemas
├── routes/                # API routes
├── server.js              # Backend server
├── package.json           # Dependencies & scripts
├── .env                   # Environment variables
└── node_modules/          # Installed packages
```

---

## ⚙️ Setup Instructions (Very Easy Steps)

Follow these steps carefully 👇

### 1️⃣ Download the Project

* Download ZIP or clone the repo

```
git clone <your-repo-link>
```

---

### 2️⃣ Open in VS Code

* Open the folder in VS Code

---

### 3️⃣ Install Dependencies

Open terminal and run:

```
npm install
```

---

### 4️⃣ Setup MongoDB Database

👉 Option 1: Local MongoDB

* Install MongoDB
* Run MongoDB service

👉 Option 2: MongoDB Atlas (Recommended)

* Create account on MongoDB Atlas
* Create cluster
* Get connection string

---

### 5️⃣ Configure `.env` File

Open `.env` file and update:

```
MONGO_URI=your_mongodb_connection_string
PORT=3000
```

Example:

```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/grocery_db
```

---

### 6️⃣ Start the Server

Run this command:

```
npm start
```

You should see:

```
Server running on port 3000
MongoDB connected successfully
```

---

### 7️⃣ Run the Project

Open browser and go to:

```
http://localhost:3000
```

---

## 🚀 How to Use (Simple Language)

### For Customer:

1. Register account
2. Login
3. Browse products
4. Add items to cart
5. Place order
6. Track orders

### For Store Owner:

1. Register as owner
2. Login
3. Add products
4. Manage orders
5. Accept / Reject orders

---

## 🔐 Environment Variables

Make sure `.env` file is properly configured, otherwise MongoDB will not connect.

---

## ❗ Important Notes

* Node.js must be installed
* MongoDB must be running OR Atlas connection should be correct
* Port 3000 should be free
* Do not upload `.env` file to GitHub

---

## 📌 Future Improvements

* Online Payment Integration
* Real-time Order Tracking
* Better UI/UX
* Admin Panel

---

## 👨‍💻 Author

**Vansh Mittal**
BTech CSE (AI & DS)

---

## ⭐ If you like this project

Give it a ⭐ on GitHub!

---
