import { Request, Response } from "express";
import { BaseRequest, UserEntry } from "../types";
import { performQuery } from "../utils/database";

export const validateUser = async (req: Request, res: Response, next: any) => {
  if (req.path === "/login") {
    console.log("skipping");
    next();
    return;
  }
  var reqBody = (
    req.body && req.body.clientid ? req.body : req.query
  ) as BaseRequest;

  let { code, rows } = await performQuery(
    `SELECT * FROM users WHERE clientid='${reqBody.clientid}';`
  );
  if (code !== 200) {
    res.status(401);
    res.send({ message: "You are not a valid user of etiennethompson.com." });
    return;
  }

  let userid = (rows[0] as UserEntry).userid;

  ({ code, rows } = await performQuery(
    `SELECT * FROM applications WHERE applicationid='${reqBody.appid}';`
  ));
  if (code !== 200) {
    res.status(401);
    res.send({
      message: "That is not a valid application of etiennethompson.com.",
    });
    return;
  }

  ({ code, rows } = await performQuery(
    `SELECT * FROM applicationusers WHERE applicationid='${reqBody.appid}' and userid='${userid}';`
  ));
  if (code !== 200) {
    res.status(401);
    res.send({ message: "You are not a user of that application." });
    return;
  }

  next();
};
