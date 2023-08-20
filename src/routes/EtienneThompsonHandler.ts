import { IDatabaseConnection } from "../utils/database";
import { ResponseHelper, SuccessfulStatusCode } from "../utils/response";
import BaseRouteHandler from "./BaseRouteHandler";

class EtienneThompsonHandler extends BaseRouteHandler {
  private responseHelper: ResponseHelper;
  constructor(responseHelper: ResponseHelper) {
    super(responseHelper.req, responseHelper.next);
    this.responseHelper = responseHelper;
  }

  public async SendSupportEmail(): Promise<void> {
    console.log("sending support email...");

    this.responseHelper.SuccessfulResponse(SuccessfulStatusCode.Ok);
  }
}

export default EtienneThompsonHandler;
