import express, { Request, Response } from "express";
import { loginHandler } from "./login";
import { getApplicationInformation, createNewApplication } from "./admin";

require("dotenv").config();
const cors = require("cors");

const app = express();
const port = process.env.PORT || "4000";

const handler = (req: Request, res: Response) => {
  return res.send("Hello world!");
};

// Allow requests from this endpoint.
var corsOptions = {
  origin: ["http://localhost:3000", "http://localhost:4000"],
};
app.use(cors(corsOptions));
app.use(express.json());

// Routes allowed for the api.
app.get("/", handler);
app.post("/login", loginHandler);
app.get("/admin", getApplicationInformation);
app.post("/admin/create", createNewApplication);

app.listen(port, () => {
  return console.log(`Server is listening on port ${port}`);
});
