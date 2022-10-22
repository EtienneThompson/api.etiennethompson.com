import { Request, Response } from "express";
import { BaseRequest, UserEntry } from "../types";
import { QueryProps, performQuery } from "../utils/database";
import { getCurrentTimeField } from "../utils/date";

export const validateUser = async (req: Request, res: Response, next: any) => {
  if (req.path === "/login") {
    next();
    return;
  }
  const client = req.body.client;

  var reqBody = (
    req.body && req.body.clientid ? req.body : req.query
  ) as BaseRequest;

  // Validate that the given clientid is a user.
  let query: QueryProps = {
    name: "validateGetUserQuery",
    text: "SELECT userid, session_expiration FROM users WHERE clientid=$1;",
    values: [reqBody.clientid],
  };
  let { code, rows } = await performQuery(client, query);
  if (code !== 200) {
    await client.end();
    res
      .status(401)
      .send({ message: "You are not a valid user of etiennethompson.com." });
    return;
  }

  // Validate that the clientid hasn't expired.
  let session_expiration = new Date((rows[0] as UserEntry).session_expiration);
  let currentTime = new Date(getCurrentTimeField());
  let diff = session_expiration.getTime() - currentTime.getTime();
  if (diff < 0) {
    await client.end();
    res
      .status(400)
      .send({ message: "Your session has expired. Please login again." });
  }

  let userid = (rows[0] as UserEntry).userid;

  query = {
    name: "validateGetApplicationQuery",
    text: "SELECT * FROM applications WHERE applicationid=$1;",
    values: [reqBody.appid],
  };
  ({ code, rows } = await performQuery(client, query));

  if (code !== 200) {
    await client.end();
    res.status(401).send({
      message: "That is not a valid application of etiennethompson.com.",
    });
    return;
  }

  query = {
    name: "validateGetApplicationUsersQuery",
    text: "SELECT * FROM applicationusers WHERE applicationid=$1 AND userid=$2;",
    values: [reqBody.appid, userid],
  };
  ({ code, rows } = await performQuery(client, query));

  if (code !== 200) {
    await client.end();
    res
      .status(401)
      .send({ message: "You are not a user of that application." });
    return;
  }

  req.body.isMock = !(rows[0].isuser || rows[0].isadmin);

  next();
};
