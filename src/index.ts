import express, { Request, Response } from "express";
import { createDatabaseConnection } from "./middleware/createDatabaseConnection";
import { closeDatabaseConnection } from "./middleware/closeDatabaseConnection";
import { validateUser } from "./middleware/validateUser";
import { loginHandler } from "./login";
import * as users from "./admin/Users";
import * as applications from "./admin/Applications";
import * as applicationUsers from "./admin/ApplicationUsers";
import * as inventory from "./inventory";

require("dotenv").config();
const cors = require("cors");
const fileUpload = require("express-fileupload");

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
app.use(fileUpload());
app.use(createDatabaseConnection);
app.use(validateUser);

// Routes allowed for the api.
app.get("/", handler);

// Login routes.
app.post("/login", loginHandler);

// Admin User routes.
app.get("/admin/users", users.getUsers);
app.post("/admin/users/create", users.createUser);
app.put("/admin/users/update", users.updateUser);
app.delete("/admin/users/delete", users.deleteUser);

// Admin Applications routes.
app.get("/admin/applications", applications.getApplications);
app.post("/admin/applications/create", applications.createApplication);
app.put("/admin/applications/update", applications.updateApplication);
app.delete("/admin/applications/delete", applications.deleteApplication);

// Admin ApplicationUsers routes.
app.get("/admin/applicationusers", applicationUsers.getApplicationUsers);
app.post(
  "/admin/applicationusers/create",
  applicationUsers.createApplicationUser
);
app.put(
  "/admin/applicationusers/update",
  applicationUsers.updateApplicationUser
);
app.delete(
  "/admin/applicationusers/delete",
  applicationUsers.deleteApplicationUser
);

// Inventory routes.
app.get("/inventory/folder", inventory.getFolder);
app.post("/inventory/folder/create", inventory.createFolder);
app.put("/inventory/folder/update", inventory.updateFolder);
app.delete("/inventory/folder/delete", inventory.deleteFolder);
app.get("/inventory/folder/base", inventory.getBaseFolder);

app.get("/inventory/item", inventory.getItem);
app.post("/inventory/item/create", inventory.createItem);
app.put("/inventory/item/update", inventory.updateItem);
app.delete("/inventory/item/delete", inventory.deleteItem);

app.use(closeDatabaseConnection);

app.listen(port, () => {
  return console.log(`Server is listening on port ${port}`);
});
