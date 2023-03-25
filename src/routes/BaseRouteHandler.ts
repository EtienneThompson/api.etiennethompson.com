import { Request, NextFunction } from "express";
import { IBaseRouteHandler } from "./IBaseRouteHandler";

class BaseRouteHandler implements IBaseRouteHandler {
  private req: Request;
  private next: NextFunction;
  constructor(req: Request, next: NextFunction) {
    this.req = req;
    this.next = next;
  }
  public async HandleRequest(handler: () => Promise<void>, mockHandler: () => Promise<void>): Promise<void> {
    try {
      await this.HandleMockRequests(handler, mockHandler);
    } catch (error: any) {
      this.next(error);
    }
  }

  public async HandleMockRequests(handler: () => Promise<void>, mockHandler: () => Promise<void>): Promise<void> {
    if (!this.req.body.isMock) {
      await handler();
    } else {
      await mockHandler();
    }
  }
}

export default BaseRouteHandler;
