import { Response, NextFunction } from "express";

export enum HttpStatusCode {
  Ok = 200,
  Created = 201,
  Accepted = 202,

  Moved = 301,
  Found = 302,

  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  RrequestTimeout = 408,

  InternalServerError = 500,
  NotImplemented = 501,
}

export enum SuccessfulStatusCode {
  Ok = 200,
  Created = 201,
  Accepted = 202,

  Moved = 301,
  Found = 302,
}

export enum ErrorStatusCode {
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  RrequestTimeout = 408,

  InternalServerError = 500,
  NotImplemented = 501,
}

export class ResponseHelper {
  res: Response;
  next: NextFunction;

  constructor(res: Response, next: NextFunction) {
    this.res = res;
    this.next = next;
  }

  public SuccessfulResponse(code: SuccessfulStatusCode, data: object) {
    this.res.status(code);
    this.res.write(JSON.stringify(data));
    this.next();
  }

  public ErrorResponse(code: ErrorStatusCode, message: string) {
    this.res.status(code);
    this.res.write(JSON.stringify({ message: message }));
    this.next();
  }

  public GenericResponse(code: HttpStatusCode, data: any = null) {
    this.res.status(code);
    if (data) {
      this.res.write(JSON.stringify(data));
    }
    this.next();
  }

  public End() {
    this.res.end();
  }
}
