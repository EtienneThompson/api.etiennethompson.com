import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { performQuery } from "../../utils/database";
import { Applications, CreateApplicationsRequest } from "./types";

export const getApplications = async (req: Request, res: Response) => {
  // select applicationname, redirecturl from applications;
  const getApplicationsQuery = "SELECT * FROM applications;";
  const { code, rows } = await performQuery(getApplicationsQuery);
  if (code === 200 && !rows) {
    res.status(400);
    res.send({ message: "No applications were found." });
  }

  res.status(200);
  res.send({ applications: rows });
};

export const createApplication = async (req: Request, res: Response) => {
  // insert into applications (applicationid, applicationname, redirecturl) values (...);
  var reqBody = req.body.newApplications as CreateApplicationsRequest[];
  let createdApplications = [] as Applications[];

  await reqBody.forEach(async (newApplication) => {
    // Generate a new applicationid.
    const newApplicationId = uuidv4();
    const createApplicationQuery = `INSERT INTO applications (applicationid, applicationname, redirecturl) VALUES ('${newApplicationId}', '${newApplication.applicationname}', '${newApplication.redirecturl}')`;
    const { code, rows } = await performQuery(createApplicationQuery);
    if (code === 200) {
      createdApplications.push(rows[0]);
    }
  });

  if (createdApplications) {
    res.status(200);
    res.send({ createdApplications: createdApplications });
  } else {
    res.status(500);
    res.send({ message: "No applications were created" });
  }
};

export const updateApplication = (req: Request, res: Response) => {
  console.log("updating application");
  res.send("updating application");
};

export const deleteApplication = (req: Request, res: Response) => {
  console.log("deleting application");
  res.send("deleting application");
};
