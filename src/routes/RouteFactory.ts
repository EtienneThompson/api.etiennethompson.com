import { Request } from "express";
import { IDatabaseConnection } from "../utils/database";
import { ResponseHelper } from "../utils/response";
import LoginHandler from "./LoginHandler";

class RouteFactory {
  private req: Request;
  constructor(req: Request) {
    this.req = req;
  }

  public getLoginHandler(): LoginHandler {
    if (!this.req.body.client) {
      throw new Error("No client in the request body.");
    }

    if (!this.req.body.response) {
      throw new Error("No response builder in the request body.");
    }

    const client = this.req.body.client as IDatabaseConnection;
    const responseHelper = this.req.body.response as ResponseHelper;

    return new LoginHandler(client, responseHelper);
  }
}

export default RouteFactory;
