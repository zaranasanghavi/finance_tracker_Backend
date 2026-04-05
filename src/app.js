const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const app = express();
app.use(express.json()); 
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
const authRoutes =
require("./modules/auth/routes");

const userRoutes = require("./modules/users/routes");

app.use("/api/users", userRoutes);
app.use(
 "/api/auth",
 authRoutes
);
const recordRoutes =
require("./modules/records/routes");

app.use(
 "/api/records",
 recordRoutes
);
const dashboardRoutes =
require("./modules/dashboard/routes");

app.use(
 "/api/dashboard",
 dashboardRoutes
);

const categoryRoutes =
require("./modules/categories/route");

app.use(
 "/api/categories",
 categoryRoutes
);

app.get("/", (req, res) => {
  res.send("Finance Tracker API running");
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    status: statusCode === 500 ? "fail" : "error",
    message: message,
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;
