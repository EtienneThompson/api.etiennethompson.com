import express, { Request, Response } from "express";
import { exceptionLogging } from "./middleware/exceptionLogging";
import { createDatabaseConnection } from "./middleware/createDatabaseConnection";
import { closeDatabaseConnectionMiddleware } from "./middleware/closeDatabaseConnection";
import { validateUser } from "./middleware/validateUser";
import * as login from "./login";
import * as dashboard from "./admin/Dashboard";
import * as users from "./admin/Users";
import * as mockUsers from "./admin/Users/mocks";
import * as applications from "./admin/Applications";
import * as mockApplications from "./admin/Applications/mocks";
import * as applicationUsers from "./admin/ApplicationUsers";
import * as mockApplicationUsers from "./admin/ApplicationUsers/mocks";
import * as inventory from "./inventory";
import * as accounting from "./thompsonaccounting";

require("dotenv").config({ path: `./.env.${process.env.APP_ENV}` });
const cors = require("cors");
const fileUpload = require("express-fileupload");

const app = express();
const port = process.env.PORT || "4000";

const handler = (req: Request, res: Response) => {
  return res.send("Hello world!");
};

const requestFactory = async (
  req: Request,
  res: Response,
  next: any,
  real: (req: Request, res: Response, next: any) => void,
  mock: (req: Request, res: Response, next: any) => void
) => {
  if (req.body.isMock) {
    await mock(req, res, next);
  } else {
    await real(req, res, next);
  }
  next();
};

// Allow requests from these endpoints.
var corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:4000",
    "http://login.etiennethompson.com",
    "http://admin.etiennethompson.com",
    "http://inventory.etiennethompson.com",
    "https://vivtho5.dreamhosters.com",
    "https://cms.vivianethompson.com",
  ],
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(fileUpload());
app.use(exceptionLogging);
app.use(createDatabaseConnection);
app.use(validateUser);

// Routes allowed for the api.
app.get("/", handler);

// Login routes.
app.post("/login", login.loginHandler);
app.post("/login/reset/request", login.sendResetPasswordEmail);
app.post("/login/reset", login.changePassword);

// Admin User routes.
app.get("/admin/dashboard/count", dashboard.getTableCounts);
app.get(
  "/admin/users",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      users.getUsers,
      mockUsers.mockGetUsers
    )
);
app.post(
  "/admin/users/create",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      users.createUser,
      mockUsers.mockCreateUser
    )
);
app.put(
  "/admin/users/update",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      users.updateUser,
      mockUsers.mockUpdateUser
    )
);
app.delete(
  "/admin/users/delete",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      users.deleteUser,
      mockUsers.mockDeleteUser
    )
);

// Admin Applications routes.
app.get(
  "/admin/applications",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      applications.getApplications,
      mockApplications.mockGetApplications
    )
);
app.post(
  "/admin/applications/create",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      applications.createApplication,
      mockApplications.mockCreateApplication
    )
);
app.put(
  "/admin/applications/update",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      applications.updateApplication,
      mockApplications.mockUpdateApplication
    )
);
app.delete(
  "/admin/applications/delete",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      applications.deleteApplication,
      mockApplications.mockDeleteApplication
    )
);

// Admin ApplicationUsers routes.
app.get(
  "/admin/applicationusers",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      applicationUsers.getApplicationUsers,
      mockApplicationUsers.mockGetApplicationUsers
    )
);
app.post(
  "/admin/applicationusers/create",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      applicationUsers.createApplicationUser,
      mockApplicationUsers.mockCreateApplicationUser
    )
);
app.put(
  "/admin/applicationusers/update",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      applicationUsers.updateApplicationUser,
      mockApplicationUsers.mockUpdateApplicationuser
    )
);
app.delete(
  "/admin/applicationusers/delete",
  async (req: Request, res: Response, next: any) =>
    await requestFactory(
      req,
      res,
      next,
      applicationUsers.deleteApplicationUser,
      mockApplicationUsers.mockDeleteApplicationUser
    )
);

// Inventory routes.
app.get("/inventory/folder", inventory.getFolder);
app.get("/inventory/folder/children", inventory.getFolderChildren);
app.post("/inventory/folder/create", inventory.createFolder);
app.put("/inventory/folder/update", inventory.updateFolder);
app.delete("/inventory/folder/delete", inventory.deleteFolder);
app.get("/inventory/folder/base", inventory.getBaseFolder);

app.get("/inventory/item", inventory.getItem);
app.post("/inventory/item/create", inventory.createItem);
app.put("/inventory/item/update", inventory.updateItem);
app.delete("/inventory/item/delete", inventory.deleteItem);

app.post("/inventory/move", inventory.moveElement);

// Thompson Accounting routes.
app.get("/thompsonaccounting/clients", accounting.getClientDetails);
app.get("/thompsonaccounting/clients/new", accounting.getNewClientSchema);
app.post("/thompsonaccounting/clients/new", accounting.postNewClientDetails);
app.put("/thompsonaccounting/clients", accounting.updateClientDetails);
app.get("/thompsonaccounting/tabs", accounting.getAllTabs);
app.post("/thompsonaccounting/tabs", accounting.createTab);
app.put("/thompsonaccounting/tabs", accounting.updateTabName);
app.delete("/thompsonaccounting/tabs", accounting.deleteTab);
app.get("/thompsonaccounting/field", accounting.getFieldsForTab);
app.get("/thompsonaccounting/field/schema", accounting.getFieldSchema);
app.get("/thompsonaccounting/allfields", accounting.getAllFields);
app.post("/thompsonaccounting/fields", accounting.createField);
app.put("/thompsonaccounting/field", accounting.updateField);
app.delete("/thompsonaccounting/field", accounting.deleteField);

app.use(closeDatabaseConnectionMiddleware);

app.listen(port, () => {
  return console.log(`Server is listening on port ${port}`);
});
