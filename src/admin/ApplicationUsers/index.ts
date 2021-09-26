import { Request, Response } from "express";
import { performQuery } from "../../utils/database";
import { ApplicationUser } from "./types";

export const getApplicationUsers = async (req: Request, res: Response) => {
  const getApplicationUserQuery = "SELECT * FROM applicationusers;";
  const { code, rows } = await performQuery(getApplicationUserQuery);
  if (code === 200 && !rows) {
    res.status(400);
    res.send({ message: "No application users were found." });
  }

  res.status(200);
  res.send({ user: rows });
};

export const createApplicationUser = async (req: Request, res: Response) => {
  var reqBody = req.body.newApplicationUsers as ApplicationUser[];
  var createdApplicationUsers = [] as ApplicationUser[];

  await reqBody.forEach(async (newApplicationUser) => {
    const createApplicationUserQuery = `INSERT INTO applicationusers (userid, applicationid, isuser, isadmin) VALUES ('${newApplicationUser.userid}', '${newApplicationUser.applicationid}', '${newApplicationUser.isuser}', '${newApplicationUser.isadmin}');`;
    const { code, rows } = await performQuery(createApplicationUserQuery);
    if (code === 200) {
      createdApplicationUsers.push(rows[0]);
    }
  });

  if (createdApplicationUsers) {
    res.status(200);
    res.send({ createdApplicationUsers: createdApplicationUsers });
  } else {
    res.status(500);
    res.send();
  }
};

export const updateApplicationUser = async (req: Request, res: Response) => {
  var reqBody = req.body.applicationuser as ApplicationUser;

  const updateApplicationUserQuery = `UPDATE applicationusers SET isuser = '${reqBody.isuser}', isadmin = '${reqBody.isadmin}' WHERE userid='${reqBody.userid}' AND applicationid='${reqBody.applicationid}');`;
  const { code, rows } = await performQuery(updateApplicationUserQuery);

  res.status(code);
  res.send();
};

export const deleteApplicationUser = async (req: Request, res: Response) => {
  var reqBody = req.body as ApplicationUser;

  const deleteUserQuery = `DELETE FROM applicationusers WHERE userid='${reqBody.userid}' AND applicationid='${reqBody.applicationid}';`;
  const { code, rows } = await performQuery(deleteUserQuery);

  res.status(code);
  res.send();
};
