import express, { Request, Response } from "express";
import { validateUser } from "./middleware/validateUser";
import { loginHandler } from "./login";
import { getUsers, createUser, updateUser, deleteUser } from "./admin/Users";
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from "./admin/Applications";
import {
  getApplicationUsers,
  createApplicationUser,
  updateApplicationUser,
  deleteApplicationUser,
} from "./admin/ApplicationUsers";

require("dotenv").config();
const cors = require("cors");

const app = express();
const port = process.env.PORT || "4000";

const handler = (req: Request, res: Response) => {
  return res.send("Hello world!");
};

// Allow requests from this endpoint.
var corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:4000",
    "http://login.etiennethompson.com",
    "http://admin.etiennethompson.com",
    "http://inventory.etiennethompson.com",
  ],
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(validateUser);

// Routes allowed for the api.
app.get("/", handler);

// Login routes.
app.post("/login", loginHandler);

// Admin User routes.
app.get("/admin/users", getUsers);
app.post("/admin/users/create", createUser);
app.put("/admin/users/update", updateUser);
app.delete("/admin/users/delete", deleteUser);

// Admin Applications routes.
app.get("/admin/applications", getApplications);
app.post("/admin/applications/create", createApplication);
app.put("/admin/applications/update", updateApplication);
app.delete("/admin/applications/delete", deleteApplication);

// Admin ApplicationUsers routes.
app.get("/admin/applicationusers", getApplicationUsers);
app.post("/admin/applicationusers/create", createApplicationUser);
app.put("/admin/applicationusers/update", updateApplicationUser);
app.delete("/admin/applicationusers/delete", deleteApplicationUser);

app.listen(port, () => {
  return console.log(`Server is listening on port ${port}`);
});
