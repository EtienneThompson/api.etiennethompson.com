import express from "express";
import { Request, Response, NextFunction } from "express";
import { exceptionLogging } from "./middleware/exceptionLogging";
import { createDatabaseConnection } from "./middleware/createDatabaseConnection";
import { closeDatabaseConnectionMiddleware } from "./middleware/closeDatabaseConnection";
import { validateUser } from "./middleware/validateUser";
import * as dashboard from "./admin/Dashboard";
import * as users from "./admin/Users";
import * as mockUsers from "./admin/Users/mocks";
import * as applications from "./admin/Applications";
import * as mockApplications from "./admin/Applications/mocks";
import * as applicationUsers from "./admin/ApplicationUsers";
import * as mockApplicationUsers from "./admin/ApplicationUsers/mocks";
import * as inventory from "./inventory";
import * as accounting from "./thompsonaccounting";
import RouteFactory from "./routes/RouteFactory";

const cors = require("cors");
const fileUpload = require("express-fileupload");

const app = express();

const handler = (req: Request, res: Response) => {
  return res.send("Hello world!");
};

const requestFactory = async (
  req: Request,
  res: Response,
  next: NextFunction,
  real: (req: Request, res: Response, next: NextFunction) => void,
  mock: (req: Request, res: Response, next: NextFunction) => void
) => {
  if (req.body.isMock) {
    await mock(req, res, next);
  } else {
    try {
      await real(req, res, next);
    } catch (error: any) {
      next(error);
      return;
    }
  }
};

const handleExceptions = async (next: NextFunction, tocall: () => void) => {
  try {
    await tocall();
  } catch (error: any) {
    next(error);
  }
};

// Allow requests from these endpoints.
var corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:4000",
    "http://localhost:5173",
    "https://login.etiennethompson.com",
    "https://admin.etiennethompson.com",
    "https://inventory.etiennethompson.com",
    "https://vivtho5.dreamhosters.com",
    "https://cms.vivianethompson.com",
    "https://qr.etiennethompson.com",
    "https://photos.etiennethompson.com",
  ],
};
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(fileUpload());
app.use(function (req, res, next) {
  res.setTimeout(60000, function () {
    console.log("Request has timed out.");
    res.send(408);
  });

  next();
});
app.use(createDatabaseConnection);
app.use(validateUser);

// Routes allowed for the api.
app.get("/", handler);

// Login routes.
app.post("/login", (req, res, next) => new RouteFactory(req).GetLoginHandler().Login());
app.post("/login/reset/request", (req, res, next) => new RouteFactory(req).GetLoginHandler().SendResetPasswordEmail());
app.post("/login/reset", (req, res, next) => new RouteFactory(req).GetLoginHandler().ChangePassword());
app.post("/login/passkey/register", (req, res, next) => new RouteFactory(req).GetLoginHandler().RegisterPasskey());
app.post("/login/passkey/options", (req, res, next) =>
  new RouteFactory(req).GetLoginHandler().GetPasskeyLoginOptions()
);
app.post("/login/passkey", (req, res, next) => new RouteFactory(req).GetLoginHandler().PasskeyLogin());

// Etiennethompson routes
app.post("/etiennethompson/support", (req, res, next) =>
  new RouteFactory(req).GetEtienneThompsonHandler().SendSupportEmail()
);

// QR Tracker routes. /qr/r/:id is the public scan link encoded in each QR code.
app.get("/qr/r/:id", (req, res, next) => new RouteFactory(req).GetQrTrackerHandler().Redirect());
app.get("/qr/codes", (req, res, next) => new RouteFactory(req).GetQrTrackerHandler().ListCodes());
app.post("/qr/codes", (req, res, next) => new RouteFactory(req).GetQrTrackerHandler().CreateCode());
app.get("/qr/codes/:id", (req, res, next) => new RouteFactory(req).GetQrTrackerHandler().GetCode());
app.patch("/qr/codes/:id", (req, res, next) => new RouteFactory(req).GetQrTrackerHandler().UpdateCode());
app.delete("/qr/codes/:id", (req, res, next) => new RouteFactory(req).GetQrTrackerHandler().DeleteCode());
app.get("/qr/codes/:id/visits", (req, res, next) => new RouteFactory(req).GetQrTrackerHandler().ListVisits());

// WeddingCam routes. Guest routes are public: guests sign in with the event's QR secret instead.
const weddingcam = (req: Request) => new RouteFactory(req).GetWeddingCamHandler();
app.post("/weddingcam/guest/session", (req, res, next) => weddingcam(req).CreateSession());
app.get("/weddingcam/guest/me", (req, res, next) => weddingcam(req).GetMe());
app.patch("/weddingcam/guest/me", (req, res, next) => weddingcam(req).UpdateMe());
app.get("/weddingcam/guest/photos", (req, res, next) => weddingcam(req).ListPhotos());
app.post("/weddingcam/guest/photos", (req, res, next) => weddingcam(req).UploadPhoto());
app.get("/weddingcam/events", (req, res, next) => weddingcam(req).ListEvents());
app.post("/weddingcam/events", (req, res, next) => weddingcam(req).CreateEvent());
app.get("/weddingcam/events/:eventId", (req, res, next) => weddingcam(req).GetEvent());
app.patch("/weddingcam/events/:eventId", (req, res, next) => weddingcam(req).UpdateEvent());
app.delete("/weddingcam/events/:eventId", (req, res, next) => weddingcam(req).DeleteEvent());
app.post("/weddingcam/events/:eventId/rotate", (req, res, next) => weddingcam(req).RotateKey());
app.post("/weddingcam/events/:eventId/export", (req, res, next) => weddingcam(req).ExportPhotos());
app.get("/weddingcam/events/:eventId/photos", (req, res, next) => weddingcam(req).ListEventPhotos());
app.patch("/weddingcam/events/:eventId/photos/:photoId", (req, res, next) => weddingcam(req).UpdatePhoto());
app.delete("/weddingcam/events/:eventId/photos/:photoId", (req, res, next) => weddingcam(req).DeletePhoto());

// Admin User routes.
app.get("/admin/dashboard/count", dashboard.getTableCounts);
app.get(
  "/admin/users",
  async (req: Request, res: Response, next: NextFunction) =>
    await requestFactory(req, res, next, users.getUsers, mockUsers.mockGetUsers)
);
app.post(
  "/admin/users/create",
  async (req: Request, res: Response, next: NextFunction) =>
    await requestFactory(req, res, next, users.createUser, mockUsers.mockCreateUser)
);
app.put(
  "/admin/users/update",
  async (req: Request, res: Response, next: NextFunction) =>
    await requestFactory(req, res, next, users.updateUser, mockUsers.mockUpdateUser)
);
app.delete(
  "/admin/users/delete",
  async (req: Request, res: Response, next: NextFunction) =>
    await requestFactory(req, res, next, users.deleteUser, mockUsers.mockDeleteUser)
);

// Admin Applications routes.
app.get(
  "/admin/applications",
  async (req: Request, res: Response, next: NextFunction) =>
    await requestFactory(req, res, next, applications.getApplications, mockApplications.mockGetApplications)
);
app.post(
  "/admin/applications/create",
  async (req: Request, res: Response, next: NextFunction) =>
    await requestFactory(req, res, next, applications.createApplication, mockApplications.mockCreateApplication)
);
app.put(
  "/admin/applications/update",
  async (req: Request, res: Response, next: NextFunction) =>
    await requestFactory(req, res, next, applications.updateApplication, mockApplications.mockUpdateApplication)
);
app.delete(
  "/admin/applications/delete",
  async (req: Request, res: Response, next: NextFunction) =>
    await requestFactory(req, res, next, applications.deleteApplication, mockApplications.mockDeleteApplication)
);

// Admin ApplicationUsers routes.
app.get(
  "/admin/applicationusers",
  async (req: Request, res: Response, next: NextFunction) =>
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
  async (req: Request, res: Response, next: NextFunction) =>
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
  async (req: Request, res: Response, next: NextFunction) =>
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
  async (req: Request, res: Response, next: NextFunction) =>
    await requestFactory(
      req,
      res,
      next,
      applicationUsers.deleteApplicationUser,
      mockApplicationUsers.mockDeleteApplicationUser
    )
);

// Inventory routes.
app.get("/inventory/folder", (req, res, next) => handleExceptions(next, () => inventory.getFolder(req, res, next)));
app.get("/inventory/folder/children", (req, res, next) =>
  handleExceptions(next, () => inventory.getFolderChildren(req, res, next))
);
app.post("/inventory/folder/create", (req, res, next) =>
  handleExceptions(next, () => inventory.createFolder(req, res, next))
);
app.put("/inventory/folder/update", (req, res, next) =>
  handleExceptions(next, () => inventory.updateFolder(req, res, next))
);
app.delete("/inventory/folder/delete", (req, res, next) =>
  handleExceptions(next, () => inventory.deleteFolder(req, res, next))
);
app.get("/inventory/folder/base", (req, res, next) =>
  handleExceptions(next, () => inventory.getBaseFolder(req, res, next))
);

app.get("/inventory/item", (req, res, next) => handleExceptions(next, () => inventory.getItem(req, res, next)));
app.post("/inventory/item/create", (req, res, next) =>
  handleExceptions(next, () => inventory.createItem(req, res, next))
);
app.put("/inventory/item/update", (req, res, next) =>
  handleExceptions(next, () => inventory.updateItem(req, res, next))
);
app.delete("/inventory/item/delete", (req, res, next) =>
  handleExceptions(next, () => inventory.deleteItem(req, res, next))
);

app.post("/inventory/move", (req, res, next) => handleExceptions(next, () => inventory.moveElement(req, res, next)));

// Thompson Accounting routes.
app.get("/thompsonaccounting/clients", (req, res, next) =>
  handleExceptions(next, () => accounting.getClientDetails(req, res, next))
);
app.get("/thompsonaccounting/clients/new", (req, res, next) =>
  handleExceptions(next, () => accounting.getNewClientSchema(req, res, next))
);
app.post("/thompsonaccounting/clients/new", (req, res, next) =>
  handleExceptions(next, () => accounting.postNewClientDetails(req, res, next))
);
app.put("/thompsonaccounting/clients", (req, res, next) =>
  handleExceptions(next, () => accounting.updateClientDetails(req, res, next))
);
app.delete("/thompsonaccounting/clients", (req, res, next) =>
  handleExceptions(next, () => accounting.deleteClient(req, res, next))
);
app.get("/thompsonaccounting/tabs", (req, res, next) =>
  handleExceptions(next, () => accounting.getAllTabs(req, res, next))
);
app.post("/thompsonaccounting/tabs", (req, res, next) =>
  handleExceptions(next, () => accounting.createTab(req, res, next))
);
app.put("/thompsonaccounting/tabs", (req, res, next) =>
  handleExceptions(next, () => accounting.updateTabName(req, res, next))
);
app.delete("/thompsonaccounting/tabs", (req, res, next) =>
  handleExceptions(next, () => accounting.deleteTab(req, res, next))
);
app.get("/thompsonaccounting/field", (req, res, next) =>
  handleExceptions(next, () => accounting.getFieldsForTab(req, res, next))
);
app.get("/thompsonaccounting/field/schema", (req, res, next) =>
  handleExceptions(next, () => accounting.getFieldSchema(req, res, next))
);
app.get("/thompsonaccounting/allfields", (req, res, next) =>
  handleExceptions(next, () => accounting.getAllFields(req, res, next))
);
app.get("/thompsonaccounting/fields/metadata", (req, res, next) =>
  handleExceptions(next, () => accounting.getFieldsMetadata(req, res, next))
);
app.post("/thompsonaccounting/fields/metadata", (req, res, next) =>
  handleExceptions(next, () => accounting.reorderFields(req, res, next))
);
app.post("/thompsonaccounting/fields/move", (req, res, next) =>
  handleExceptions(next, () => accounting.moveField(req, res, next))
);
app.post("/thompsonaccounting/fields", (req, res, next) =>
  handleExceptions(next, () => accounting.createField(req, res, next))
);
app.put("/thompsonaccounting/field", (req, res, next) =>
  handleExceptions(next, () => accounting.updateField(req, res, next))
);
app.delete("/thompsonaccounting/field", (req, res, next) =>
  handleExceptions(next, () => accounting.deleteField(req, res, next))
);

app.use(exceptionLogging);
app.use(closeDatabaseConnectionMiddleware);

export default app;
