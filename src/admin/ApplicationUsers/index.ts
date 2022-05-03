import { Request, Response } from "express";
import { QueryProps, performQuery } from "../../utils/database";
import { ApplicationUser } from "./types";

export const getApplicationUsers = async (
  req: Request,
  res: Response,
  next: any
) => {
  const client = req.body.client;

  let query: QueryProps = {
    text: "SELECT * FROM applicationusers;",
    values: [],
  };
  const { code, rows } = await performQuery(client, query);
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

  let query: QueryProps = {
    text: "INSERT INTO applicationusers (userid, applicationid, isuser, isadmin) VALUES ('$1', '$2', '$3', '$4');",
    values: [
      newApplicationUser.userid,
      newApplicationUser.applicationid,
      String(newApplicationUser.isuser),
      String(newApplicationUser.isadmin),
    ],
  };
  const { code, rows } = await performQuery(client, query);

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

  let query: QueryProps = {
    text: "UPDATE applicationusers SET isuser='$1', isadmin='$2' WHERE userid='$3' AND applicationid='$4';",
    values: [
      String(reqBody.isuser),
      String(reqBody.isadmin),
      reqBody.userid,
      reqBody.applicationid,
    ],
  };
  const { code, rows } = await performQuery(client, query);

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

  let query: QueryProps = {
    text: "DELETE FROM applicationusers WHERE userid='$1' AND applicationid='$2';",
    values: [reqBody.userid, reqBody.applicationid],
  };
  const { code, rows } = await performQuery(client, query);

  res.status(code);
  next();
};
