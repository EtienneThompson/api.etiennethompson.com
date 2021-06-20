import express, { Request, Response } from "express";

const app = express();
const port = process.env.PORT || "4000";

const handler = (req: Request, res: Response) => {
  return res.send("Hello world!");
};

app.get("/", handler);

app.listen(port, () => {
  return console.log(`Server is listening on port ${port}`);
});
