import { Request } from "express";
import { IDatabaseConnection } from "../utils/database";
import { ResponseHelper } from "../utils/response";
import LoginHandler from "./LoginHandler";
import aws from "aws-sdk";
import EtienneThompsonHandler from "./EtienneThompsonHandler";

class RouteFactory {
  private req: Request;
  private aws: any;
  constructor(req: Request) {
    this.req = req;

    this.aws = aws;
    this.aws.config.update({
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      region: "us-west-2",
    });
  }

  public GetLoginHandler(): LoginHandler {
    if (!this.req.body.client) {
      throw new Error("No client in the request body.");
    }

    if (!this.req.body.response) {
      throw new Error("No response builder in the request body.");
    }

    const client = this.req.body.client as IDatabaseConnection;
    const responseHelper = this.req.body.response as ResponseHelper;

    return new LoginHandler(client, responseHelper, this.aws);
  }

  public GetEtienneThompsonHandler(): EtienneThompsonHandler {
    if (!this.req.body.response) {
      throw new Error("No response builder in the request body.");
    }

    const responseHelper = this.req.body.response as ResponseHelper;

    return new EtienneThompsonHandler(responseHelper, this.aws);
  }
}

export default RouteFactory;
