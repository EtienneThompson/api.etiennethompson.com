import { Request, Response } from "express";
import { performQuery } from "../../utils/database";
import { ApplicationUser } from "./types";

export const getApplicationUsers = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  const getApplicationUserQuery = "SELECT * FROM applicationusers;";
  const { code, rows } = await performQuery(client, getApplicationUserQuery);
  if (code === 200 && !rows) {
    res.status(400);
    res.write(JSON.stringify({ message: "No application users were found." }));
  } else {
    res.status(200);
    res.write(JSON.stringify({ applicationUsers: rows }));
  }
  next();
};

export const createApplicationUser = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  var newApplicationUser = req.body.newApplicationUser as ApplicationUser;

  const createApplicationUserQuery = `INSERT INTO applicationusers (userid, applicationid, isuser, isadmin) VALUES ('${newApplicationUser.userid}', '${newApplicationUser.applicationid}', '${newApplicationUser.isuser}', '${newApplicationUser.isadmin}');`;
  const { code, rows } = await performQuery(
    client,
    createApplicationUserQuery
  );

  if (code === 200) {
    res.status(200);
    res.write(
      JSON.stringify({
        createdApplicationUser: {
          userid: newApplicationUser.userid,
          applicationid: newApplicationUser.applicationid,
          isuser: newApplicationUser.isuser,
          isadmin: newApplicationUser.isadmin,
        },
      })
    );
  } else {
    res.status(500);
  }
  next();
};

export const updateApplicationUser = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  var reqBody = req.body.applicationuser as ApplicationUser;

  const updateApplicationUserQuery = `UPDATE applicationusers SET isuser = '${reqBody.isuser}', isadmin = '${reqBody.isadmin}' WHERE userid='${reqBody.userid}' AND applicationid='${reqBody.applicationid}';`;
  const { code, rows } = await performQuery(
    client,
    updateApplicationUserQuery
  );

  res.status(code);
  next();
};

export const deleteApplicationUser = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;
  var reqBody = req.body.applicationuser as ApplicationUser;

  const deleteUserQuery = `DELETE FROM applicationusers WHERE userid='${reqBody.userid}' AND applicationid='${reqBody.applicationid}';`;
  const { code, rows } = await performQuery(client, deleteUserQuery);

  res.status(code);
  next();
};
