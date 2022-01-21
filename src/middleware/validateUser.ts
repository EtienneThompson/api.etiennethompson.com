import { Request, Response } from "express";
import { BaseRequest, UserEntry } from "../types";
import { performQuery } from "../utils/database";
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
  let { code, rows } = await performQuery(
    client,
    `SELECT * FROM users WHERE clientid='${reqBody.clientid}';`
  );
  if (code !== 200) {
    await client.close();
    res.status(401);
    res.send({ message: "You are not a valid user of etiennethompson.com." });
    return;
  }

  // Validate that the clientid hasn't expired.
  let session_expiration = new Date((rows[0] as UserEntry).session_expiration);
  let currentTime = new Date(getCurrentTimeField());
  let diff = session_expiration.getTime() - currentTime.getTime();
  if (diff < 0) {
    await client.close();
    res.status(400);
    res.send({ message: "Your session has expired. Please login again." });
  }

  let userid = (rows[0] as UserEntry).userid;

  ({ code, rows } = await performQuery(
    client,
    `SELECT * FROM applications WHERE applicationid='${reqBody.appid}';`
  ));
  if (code !== 200) {
    await client.close();
    res.status(401);
    res.send({
      message: "That is not a valid application of etiennethompson.com.",
    });
    return;
  }

  ({ code, rows } = await performQuery(
    client,
    `SELECT * FROM applicationusers WHERE applicationid='${reqBody.appid}' and userid='${userid}';`
  ));
  if (code !== 200) {
    await client.close();
    res.status(401);
    res.send({ message: "You are not a user of that application." });
    return;
  }

  next();
};
