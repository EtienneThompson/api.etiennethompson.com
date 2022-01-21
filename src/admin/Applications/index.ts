import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { performQuery } from "../../utils/database";
import { Applications, CreateApplicationsRequest } from "./types";

export const getApplications = async (req: Request, res: Response) => {
  const client = req.body.client;
  // select applicationname, redirecturl from applications;
  const getApplicationsQuery = "SELECT * FROM applications;";
  const { code, rows } = await performQuery(client, getApplicationsQuery);
  if (code === 200 && !rows) {
    res.status(400);
    res.write(JSON.stringify({ message: "No applications were found." }));
  }

  res.status(200);
  res.write(JSON.stringify({ applications: rows }));
};

export const createApplication = async (req: Request, res: Response) => {
  const client = req.body.client;
  // insert into applications (applicationid, applicationname, redirecturl) values (...);
  var newApplication = req.body.newApplication as CreateApplicationsRequest;

  // Generate a new applicationid.
  const newApplicationId = uuidv4();
  const createApplicationQuery = `INSERT INTO applications (applicationid, applicationname, redirecturl) VALUES ('${newApplicationId}', '${newApplication.applicationname}', '${newApplication.redirecturl}')`;
  const { code, rows } = await performQuery(client, createApplicationQuery);

  if (code === 200) {
    res.status(200);
    res.write(
      JSON.stringify({
        createdApplication: {
          applicationid: newApplicationId,
          applicationname: newApplication.applicationname,
          redirecturl: newApplication.redirecturl,
        },
      })
    );
  } else {
    res.status(500);
    res.write(JSON.stringify({ message: "No applications were created" }));
  }
};

export const updateApplication = async (req: Request, res: Response) => {
  const client = req.body.client;
  // update applications set applicationname = '${appicationname}', redirecturl = '${redirecturl}' where applicationid='${applicationid}';
  var reqBody = req.body.application as Applications;

  const updateApplicationQuery = `UPDATE applications SET applicationname = '${reqBody.applicationname}', redirecturl = '${reqBody.redirecturl}' WHERE applicationid='${reqBody.applicationid}';`;
  const { code, rows } = await performQuery(client, updateApplicationQuery);

  if (code === 200) {
    res.status(200);
  } else {
    res.status(404);
    res.write(
      JSON.stringify({ message: "An application for that id does not exist." })
    );
  }
};

export const deleteApplication = async (req: Request, res: Response) => {
  const client = req.body.client;
  var reqBody = req.body.application as Applications;

  const deleteApplicationQuery = `DELETE FROM applications WHERE applicationid='${reqBody.applicationid}';`;
  const { code, rows } = await performQuery(client, deleteApplicationQuery);

  if (code === 200) {
    res.status(200);
  } else {
    res.status(404);
    res.write(
      JSON.stringify({ message: "An application for that id does not exist." })
    );
  }
};
