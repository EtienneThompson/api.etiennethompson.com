import { Request, Response } from "express";
import { performQuery } from "../../utils/database";

export const getApplications = async (req: Request, res: Response) => {
  // select applicationname, redirecturl from applications;
  const getApplicationsQuery =
    "select applicationname, redirecturl from applications;";
  const { code, rows } = await performQuery(getApplicationsQuery);
  if (code === 200 && !rows) {
    res.status(400);
    res.send({ message: "No applications were found." });
  }

  res.status(200);
  res.send({ applications: rows });
};

export const createApplication = (req: Request, res: Response) => {
  console.log("create new application");
  res.send("admin post endpoint");
};

export const updateApplication = (req: Request, res: Response) => {
  console.log("updating application");
  res.send("updating application");
};

export const deleteApplication = (req: Request, res: Response) => {
  console.log("deleting application");
  res.send("deleting application");
};
